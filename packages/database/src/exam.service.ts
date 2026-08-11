import QRCode from 'qrcode';
import { Answer, Exam, ExamStatus, Prisma, QuestionType } from '@prisma/client';
import prisma from '../../../prisma/client.js';
import { ExamSettingsShape } from './shuffle.service.js';

/** Camel-case API input shape (what the REST layer accepts). */
export interface ExamCreationData {
  title: string;
  description?: string | null;
  durationMinutes: number;
  totalMarks: number;
  status?: ExamStatus;
  settings?: ExamSettingsShape;
}

export interface QuestionCreationData {
  type: QuestionType;
  questionText: string;
  /** JSON-serializable options (array of strings, grid structure, etc.). Validated upstream. */
  options?: unknown;
  /** Required for objective questions; optional for e.g. subjective types. */
  correctAnswer?: string;
  marks: number;
}

export interface SubmissionCreationData {
  questionId: string;
  answerText: string;
}

export interface PublishExamResult {
  access_uuid: string;
  shareable_link: string;
  qr_code_url: string;
  exam: Exam;
}

const STUDENT_QUESTION_SELECT = {
  id: true,
  question_text: true,
  type: true,
  options: true,
  marks: true,
} satisfies Prisma.QuestionSelect;

export async function createExamWithQuestions(
  teacherId: string,
  examData: ExamCreationData,
  questionsData: QuestionCreationData[],
): Promise<Exam> {
  return prisma.$transaction(async (tx) => {
    return tx.exam.create({
      data: {
        title: examData.title,
        description: examData.description ?? null,
        duration_minutes: examData.durationMinutes,
        total_marks: examData.totalMarks,
        status: examData.status ?? ExamStatus.DRAFT,
        settings: examData.settings
          ? (examData.settings as Prisma.InputJsonValue)
          : undefined,
        created_by: teacherId,
        access_uuid: crypto.randomUUID(),
        questions: {
          create: questionsData.map((q) => ({
            type: q.type,
            question_text: q.questionText,
            options:
              q.options !== undefined && q.options !== null
                ? (q.options as Prisma.InputJsonValue)
                : undefined,
            correct_answer: q.correctAnswer ?? null,
            marks: q.marks,
          })),
        },
      },
      include: {
        questions: true,
      },
    });
  });
}

export async function getExamForStudent(examId: string) {
  return prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      description: true,
      duration_minutes: true,
      total_marks: true,
      status: true,
      end_time: true,
      settings: true,
      questions: {
        select: STUDENT_QUESTION_SELECT,
      },
    },
  });
}

export async function recordSubmissions(
  sessionId: string,
  submissions: SubmissionCreationData[],
): Promise<Answer[]> {
  const saved: Answer[] = [];

  for (const { questionId, answerText } of submissions) {
    saved.push(
      await prisma.answer.upsert({
        where: {
          session_id_question_id: { session_id: sessionId, question_id: questionId },
        },
        create: {
          session_id: sessionId,
          question_id: questionId,
          answer_text: answerText,
        },
        update: {
          answer_text: answerText,
        },
      }),
    );
  }

  return saved;
}

/**
 * Publishes a DRAFT exam after verifying it has at least one question.
 * Generates a unique access_uuid and a QR code Data URL pointing to the shareable link.
 * Updates exam status to PUBLISHED in a Prisma transaction.
 */
export async function publishExamService(
  examId: string,
  teacherId: string,
  baseUrl = process.env.FRONTEND_URL || 'https://examora.app'
): Promise<PublishExamResult> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      _count: {
        select: { questions: true },
      },
    },
  });

  if (!exam) {
    throw new Error('EXAM_NOT_FOUND');
  }

  if (exam.created_by !== teacherId) {
    throw new Error('UNAUTHORIZED');
  }

  if (exam.status !== ExamStatus.DRAFT) {
    throw new Error(`INVALID_STATUS: Exam must be in DRAFT status to publish. Current status: ${exam.status}`);
  }

  if (exam._count.questions === 0) {
    throw new Error('NO_QUESTIONS: Cannot publish an exam without questions. Please add at least one question.');
  }

  const access_uuid = crypto.randomUUID();
  const shareable_link = `${baseUrl}/exam/${access_uuid}`;

  // Requirement 2: Generate QR code Data URL pointing to https://examora.app/exam/${access_uuid}
  const qr_code_url = await QRCode.toDataURL(shareable_link, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 2,
    scale: 6,
  });

  // Requirement 2: Update exam in Prisma transaction. The status is guarded
  // atomically (WHERE status = DRAFT) so two concurrent publish requests cannot
  // both transition the exam — the loser gets INVALID_STATUS.
  const result = await prisma.$transaction(async (tx) => {
    return tx.exam.updateMany({
      where: { id: examId, created_by: teacherId, status: ExamStatus.DRAFT },
      data: {
        status: ExamStatus.ACTIVE,
        published_at: new Date(),
        access_uuid,
        qr_code_url,
      },
    });
  });

  if (result.count === 0) {
    const fresh = await prisma.exam.findUnique({
      where: { id: examId },
      select: { status: true },
    });
    throw new Error(
      fresh
        ? `INVALID_STATUS: Exam was already ${fresh.status.toLowerCase()}`
        : 'EXAM_NOT_FOUND',
    );
  }

  const updatedExam = await prisma.exam.findUniqueOrThrow({
    where: { id: examId },
  });

  return {
    access_uuid,
    shareable_link,
    qr_code_url,
    exam: updatedExam,
  };
}

/**
 * Unpublishes an active/published exam, returning it back to DRAFT status.
 * Resets published_at and qr_code_url in a Prisma transaction.
 */
export async function unpublishExamService(
  examId: string,
  teacherId: string
): Promise<Exam> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, status: true, created_by: true },
  });

  if (!exam) {
    throw new Error('EXAM_NOT_FOUND');
  }

  if (exam.created_by !== teacherId) {
    throw new Error('UNAUTHORIZED');
  }

  if (exam.status === ExamStatus.DRAFT) {
    throw new Error('INVALID_STATUS: Exam is already in DRAFT status');
  }

  if (exam.status === ExamStatus.COMPLETED) {
    throw new Error('INVALID_STATUS: Completed exams cannot be unpublished');
  }

  const freshAccessUuid = crypto.randomUUID();

  // Requirement 3: Reverts status to DRAFT and nullifies/resets access in a
  // Prisma transaction. The WHERE status guard makes the transition atomic —
  // a concurrent unpublish/publish call cannot double-fire.
  const result = await prisma.$transaction(async (tx) => {
    return tx.exam.updateMany({
      where: {
        id: examId,
        created_by: teacherId,
        status: { in: [ExamStatus.ACTIVE, ExamStatus.PUBLISHED] },
      },
      data: {
        status: ExamStatus.DRAFT,
        published_at: null,
        access_uuid: freshAccessUuid,
        qr_code_url: null,
      },
    });
  });

  if (result.count === 0) {
    const fresh = await prisma.exam.findUnique({
      where: { id: examId },
      select: { status: true },
    });
    throw new Error(
      fresh
        ? `INVALID_STATUS: Exam is already in ${fresh.status.toLowerCase()} status`
        : 'EXAM_NOT_FOUND',
    );
  }

  return prisma.exam.findUniqueOrThrow({ where: { id: examId } });
}
