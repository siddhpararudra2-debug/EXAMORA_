import { Exam, ExamStatus, Prisma, QuestionType } from '@prisma/client';
import prisma from '../../../prisma/client.js';

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
  questionText: true,
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
        ...examData,
        createdBy: teacherId,
        status: examData.status ?? ExamStatus.DRAFT,
        questions: {
          create: questionsData,
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
      durationMinutes: true,
      totalMarks: true,
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
  return prisma.submission.createMany({
    data: submissions.map(({ questionId, answerText }) => ({
      sessionId,
      questionId,
      answerText,
    })),
    skipDuplicates: true,
  });
}
