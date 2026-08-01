import { Question, QuestionType, SubmissionStatus } from '@prisma/client';
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
  question: Pick<Question, 'type' | 'correct_answer'>,
  answerText: string
): boolean => {
  const submitted = answerText.trim();
  const correct = question.correct_answer?.trim() ?? '';

  if (
    question.type === QuestionType.MCQ_SINGLE ||
    question.type === QuestionType.MCQ_MULTI ||
    question.type === QuestionType.TRUE_FALSE ||
    question.type === QuestionType.FILL_BLANK ||
    question.type === QuestionType.DROPDOWN
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
    const session = await tx.examSession.findFirst({
      where: { id: sessionId, exam_id: examId },
      select: { id: true },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found for exam ${examId}`);
    }

    const [answers, questions] = await Promise.all([
      tx.answer.findMany({
        where: { session_id: sessionId },
        select: { question_id: true, answer_text: true },
      }),
      tx.question.findMany({
        where: { exam_id: examId },
        select: { id: true, type: true, correct_answer: true, marks: true, negative_marks: true },
      }),
    ]);

    const questionById = new Map(questions.map((q) => [q.id, q]));

    let score = 0;
    let correctAnswers = 0;

    for (const answer of answers) {
      const question = questionById.get(answer.question_id);
      if (!question) {
        continue;
      }

      if (isAnswerCorrect(question, answer.answer_text)) {
        score += question.marks;
        correctAnswers += 1;
      }
    }

    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

    // Persist grading outcome on the session (score + percentage). The session
    // status stays SUBMITTED / AUTO_SUBMITTED — "graded" is represented by
    // total_score being set, which is what results/email dispatch rely on.
    await tx.examSession.update({
      where: { id: sessionId },
      data: {
        total_score: score,
        percentage,
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
  const sessions = await prisma.examSession.findMany({
    where: {
      exam_id: examId,
      status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.AUTO_SUBMITTED] },
    },
    select: { id: true },
  });

  const results: GradingResult[] = [];
  for (const session of sessions) {
    results.push(await gradeSubmission(examId, session.id));
  }

  return results;
}
