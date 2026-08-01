import { Exam, ExamStatus, Prisma, QuestionType } from '@prisma/client';
import prisma from '../../../prisma/client.js';

/** Camel-case API input shape (what the REST layer accepts). */
export interface ExamCreationData {
  title: string;
  description?: string | null;
  durationMinutes: number;
  totalMarks: number;
  status?: ExamStatus;
}

export interface QuestionCreationData {
  type: QuestionType;
  questionText: string;
  options?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  correctAnswer: string;
  marks: number;
}

export interface SubmissionCreationData {
  questionId: string;
  answerText: string;
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
        created_by: teacherId,
        access_uuid: crypto.randomUUID(),
        questions: {
          create: questionsData.map((q) => ({
            type: q.type,
            question_text: q.questionText,
            options: q.options ?? undefined,
            correct_answer: q.correctAnswer,
            marks: q.marks,
          })),
        },
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
      questions: {
        select: STUDENT_QUESTION_SELECT,
      },
    },
  });
}

export async function recordSubmissions(
  sessionId: string,
  submissions: SubmissionCreationData[],
) {
  return prisma.answer.createMany({
    data: submissions.map(({ questionId, answerText }) => ({
      session_id: sessionId,
      question_id: questionId,
      answer_text: answerText,
    })),
    skipDuplicates: true,
  });
}
