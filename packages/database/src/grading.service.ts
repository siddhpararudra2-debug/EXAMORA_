import { GradedBy, Question, QuestionType, SubmissionStatus } from '@prisma/client';
import prisma from '../../../prisma/client.js';

const AI_GRADING_URL =
  process.env.AI_GRADING_URL ?? 'http://localhost:8001/api/v1/ai/grade-subjective';
const AI_GRADING_TIMEOUT_MS = 10_000;

export interface GradingResult {
  sessionId: string;
  score: number;
  totalMarks: number;
  correctAnswers: number;
  totalQuestions: number;
}

interface AiGradingResponse {
  marks_awarded?: unknown;
  confidence?: unknown;
  feedback?: unknown;
}

export interface AiGradingOutcome {
  marksAwarded: number;
  confidence: number;
  feedback: string;
}

interface AnswerGradingUpdate {
  questionId: string;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  gradedBy: GradedBy;
  teacherFeedback: string | null;
  aiConfidence: number | null;
}

const normalize = (value: string): string => value.trim().toLowerCase();

const isSubjective = (type: QuestionType): boolean =>
  type === QuestionType.SHORT_ANSWER || type === QuestionType.LONG_ANSWER;

const isManualGrading = (type: QuestionType): boolean =>
  type === QuestionType.FILE_UPLOAD;

const isAnswerCorrect = (
  question: Pick<Question, 'type' | 'correct_answer'>,
  answerText: string
): boolean => {
  const submitted = answerText.trim();
  const correct = question.correct_answer?.trim() ?? '';

  if (!submitted || !correct) {
    return false;
  }

  // Objective string/selection matching types
  if (
    question.type === QuestionType.MCQ_SINGLE ||
    question.type === QuestionType.TRUE_FALSE ||
    question.type === QuestionType.FILL_BLANK ||
    question.type === QuestionType.DROPDOWN ||
    question.type === QuestionType.DATE ||
    question.type === QuestionType.LINEAR_SCALE
  ) {
    return normalize(submitted) === normalize(correct);
  }

  // Multi-choice: compare normalized set of options (comma-separated or JSON)
  if (question.type === QuestionType.MCQ_MULTI) {
    const normSub = normalize(submitted).split(',').map((s) => s.trim()).filter(Boolean).sort().join(',');
    const normCorr = normalize(correct).split(',').map((s) => s.trim()).filter(Boolean).sort().join(',');
    return normSub === normCorr;
  }

  // Grid types (RADIO_GRID, CHECKBOX_GRID): compare normalized JSON or string
  if (question.type === QuestionType.RADIO_GRID || question.type === QuestionType.CHECKBOX_GRID) {
    try {
      const parsedSub = JSON.parse(submitted);
      const parsedCorr = JSON.parse(correct);
      return JSON.stringify(parsedSub) === JSON.stringify(parsedCorr);
    } catch {
      return normalize(submitted) === normalize(correct);
    }
  }

  return normalize(submitted) === normalize(correct);
};

/**
 * Calls the Python AI service to grade a subjective (short/long answer) question.
 * Throws on network failure, non-2xx response, or malformed payload so callers
 * can decide how to fall back.
 */
export async function gradeSubjectiveWithAI(
  questionText: string,
  studentAnswer: string,
  maxMarks: number,
): Promise<AiGradingOutcome> {
  let response: Response;

  try {
    response = await fetch(AI_GRADING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_text: questionText,
        student_answer: studentAnswer,
        max_marks: maxMarks,
      }),
      signal: AbortSignal.timeout(AI_GRADING_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`AI grading service unreachable at ${AI_GRADING_URL}: ${reason}`);
  }

  if (!response.ok) {
    throw new Error(
      `AI grading service returned ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as AiGradingResponse;
  const marksAwarded = Number(data.marks_awarded);

  if (!Number.isFinite(marksAwarded) || marksAwarded < 0) {
    throw new Error('AI grading service returned an invalid marks_awarded value');
  }

  const confidence = Number(data.confidence);
  const feedback = typeof data.feedback === 'string' ? data.feedback : '';

  return {
    marksAwarded: Math.min(marksAwarded, maxMarks),
    confidence: Number.isFinite(confidence) ? confidence : 0,
    feedback,
  };
}

export async function gradeSubmission(
  examId: string,
  sessionId: string,
): Promise<GradingResult> {
  const session = await prisma.examSession.findFirst({
    where: { id: sessionId, exam_id: examId },
    select: { id: true },
  });

  if (!session) {
    throw new Error(`Session ${sessionId} not found for exam ${examId}`);
  }

  const [answers, questions] = await Promise.all([
    prisma.answer.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: 'asc' },
      select: { question_id: true, answer_text: true },
    }),
    prisma.question.findMany({
      where: { exam_id: examId },
      select: {
        id: true,
        type: true,
        question_text: true,
        correct_answer: true,
        marks: true,
        negative_marks: true,
      },
    }),
  ]);

  const questionById = new Map(questions.map((q) => [q.id, q]));

  // rawScore accumulates marks and deductions WITHOUT clamping — clamping is
  // applied to the final total only, so the answer order cannot affect the
  // result (e.g. a correct +10 after a wrong -5 must net +5).
  let rawScore = 0;
  let correctAnswers = 0;
  const updates: AnswerGradingUpdate[] = [];

  for (const answer of answers) {
    const question = questionById.get(answer.question_id);
    if (!question) {
      continue;
    }

    // 1. FILE_UPLOAD questions require manual teacher grading
    if (isManualGrading(question.type)) {
      updates.push({
        questionId: question.id,
        isCorrect: null,
        marksAwarded: null,
        gradedBy: GradedBy.TEACHER,
        teacherFeedback: 'File upload submission requires teacher grading.',
        aiConfidence: null,
      });
      continue;
    }

    if (isAnswerCorrect(question, answer.answer_text)) {
      rawScore += question.marks;
      correctAnswers += 1;
      updates.push({
        questionId: question.id,
        isCorrect: true,
        marksAwarded: question.marks,
        gradedBy: GradedBy.AUTO,
        teacherFeedback: null,
        aiConfidence: null,
      });
      continue;
    }

    // Subjective questions cannot be graded by string equality — delegate to
    // the AI service. Partial marks are supported, so is_correct reflects
    // "received any marks".
    if (isSubjective(question.type)) {
      try {
        const ai = await gradeSubjectiveWithAI(
          question.question_text,
          answer.answer_text,
          question.marks,
        );

        rawScore += ai.marksAwarded;
        updates.push({
          questionId: question.id,
          isCorrect: ai.marksAwarded > 0,
          marksAwarded: ai.marksAwarded,
          gradedBy: GradedBy.AI,
          teacherFeedback: ai.feedback || null,
          aiConfidence: ai.confidence,
        });
      } catch (error) {
        // AI service unavailable — do not guess. Flag the answer for manual
        // review and keep grading of the rest of the session going.
        console.error(
          `AI grading failed for question ${question.id} in session ${sessionId}:`,
          error,
        );
        updates.push({
          questionId: question.id,
          isCorrect: null,
          marksAwarded: null,
          gradedBy: GradedBy.TEACHER,
          teacherFeedback: null,
          aiConfidence: null,
        });
      }
      continue;
    }

    // Objective question, wrong answer → apply negative marking when configured.
    // Deduction is accumulated into the unclamped running total.
    const negativeMarks = Number(question.negative_marks);
    if (negativeMarks > 0) {
      rawScore -= negativeMarks;
    }

    updates.push({
      questionId: question.id,
      isCorrect: false,
      marksAwarded: 0,
      gradedBy: GradedBy.AUTO,
      teacherFeedback: null,
      aiConfidence: null,
    });
  }

  // Clamp the final total exactly once, after all deductions are accumulated.
  const score = Math.max(0, rawScore);
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

  // Persist grading outcome on the session (score + percentage) and write
  // per-answer results (correctness, marks, grading source, AI feedback).
  // The session status stays SUBMITTED / AUTO_SUBMITTED — "graded" is
  // represented by total_score being set, which is what results/email
  // dispatch rely on.
  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      await tx.answer.updateMany({
        where: { session_id: sessionId, question_id: update.questionId },
        data: {
          is_correct: update.isCorrect,
          marks_awarded: update.marksAwarded,
          graded_by: update.gradedBy,
          teacher_feedback: update.teacherFeedback,
          ai_confidence: update.aiConfidence,
        },
      });
    }

    await tx.examSession.update({
      where: { id: sessionId },
      data: {
        total_score: score,
        percentage,
      },
    });
  });

  return {
    sessionId,
    score,
    totalMarks,
    correctAnswers,
    totalQuestions: questions.length,
  };
}

export async function gradeAllSubmissionsForExam(
  examId: string,
): Promise<GradingResult[]> {
  const sessions = await prisma.examSession.findMany({
    where: {
      exam_id: examId,
      status: {
        in: [
          SubmissionStatus.SUBMITTED,
          SubmissionStatus.AUTO_SUBMITTED,
          SubmissionStatus.TERMINATED,
        ],
      },
    },
    select: { id: true },
  });

  const results: GradingResult[] = [];
  for (const session of sessions) {
    results.push(await gradeSubmission(examId, session.id));
  }

  return results;
}
