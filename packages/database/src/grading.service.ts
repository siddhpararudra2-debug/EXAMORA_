import { Question, QuestionType, SessionStatus } from '@prisma/client';
import prisma from '../../../prisma/client.js';

export interface GradingResult {
  sessionId: string;
  score: number;
  totalMarks: number;
  correctAnswers: number;
  totalQuestions: number;
}

const normalize = (value: string): string => value.trim().toLowerCase();

const isAnswerCorrect = (
  question: Pick<Question, 'type' | 'correctAnswer'>,
  answerText: string
): boolean => {
  const submitted = answerText.trim();
  const correct = question.correctAnswer.trim();

  if (
    question.type === QuestionType.MCQ ||
    question.type === QuestionType.TRUE_FALSE
  ) {
    return normalize(submitted) === normalize(correct);
  }

  return submitted === correct;
};

export async function gradeSubmission(
  examId: string,
  sessionId: string,
): Promise<GradingResult> {
  return prisma.$transaction(async (tx) => {
    const session = await tx.studentSession.findFirst({
      where: { id: sessionId, examId },
      select: { id: true },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found for exam ${examId}`);
    }

    const [submissions, questions] = await Promise.all([
      tx.submission.findMany({
        where: { sessionId },
        select: { questionId: true, answerText: true },
      }),
      tx.question.findMany({
        where: { examId },
        select: { id: true, type: true, correctAnswer: true, marks: true },
      }),
    ]);

    const questionById = new Map(questions.map((q) => [q.id, q]));

    let score = 0;
    let correctAnswers = 0;

    for (const submission of submissions) {
      const question = questionById.get(submission.questionId);
      if (!question) {
        continue;
      }

      if (isAnswerCorrect(question, submission.answerText)) {
        score += question.marks;
        correctAnswers += 1;
      }
    }

    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

    await tx.studentSession.update({
      where: { id: sessionId },
      data: {
        score,
        status: SessionStatus.GRADED,
      },
    });

    return {
      sessionId,
      score,
      totalMarks,
      correctAnswers,
      totalQuestions: questions.length,
    };
  });
}

export async function gradeAllSubmissionsForExam(
  examId: string,
): Promise<GradingResult[]> {
  const sessions = await prisma.studentSession.findMany({
    where: { examId, status: SessionStatus.SUBMITTED },
    select: { id: true },
  });

  const results: GradingResult[] = [];
  for (const session of sessions) {
    results.push(await gradeSubmission(examId, session.id));
  }

  return results;
}
