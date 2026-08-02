import { Request, Response, NextFunction } from 'express';
import { Prisma, PrismaClient, SubmissionStatus, ViolationType } from '@prisma/client';

import { AuthenticatedStudentRequest } from '../middleware/validateStudentSession.js';
import { gradeSubmission } from '../../packages/database/src/grading.service.js';

const prisma = new PrismaClient();

// ── POST /api/v1/exam-session/:token/answer ─────────────────────────────────────
// Authenticated by validateStudentSession (Bearer session token).
// Body: SaveAnswerInput — { questionId, answerData }
// Upserts the answer so autosave retries / changed answers always overwrite.

export const saveAnswer = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { studentSession } = req as AuthenticatedStudentRequest;
    const { questionId, answerData } = req.body as {
      questionId: string;
      answerData: string;
    };

    const question = await prisma.question.findFirst({
      where: { id: questionId, exam_id: studentSession.examId },
      select: { id: true },
    });

    if (!question) {
      res.status(400).json({
        status: 'error',
        message: 'Question does not belong to this exam',
      });
      return;
    }

    const answer = await prisma.answer.upsert({
      where: {
        session_id_question_id: {
          session_id: studentSession.id,
          question_id: questionId,
        },
      },
      create: {
        session_id: studentSession.id,
        question_id: questionId,
        answer_text: answerData,
      },
      update: {
        answer_text: answerData,
      },
      select: { updated_at: true },
    });

    res.json({
      status: 'success',
      data: {
        answer: {
          questionId,
          savedAt: answer.updated_at,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/v1/exam-session/:token/violation ─────────────────────────────────
// Authenticated by validateStudentSession (Bearer session token).
// Body: ViolationInput — { type, description?, metadata? }
// Inserts a proctoring violation for the session.

export const reportViolation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { studentSession } = req as AuthenticatedStudentRequest;
    const { type, description, metadata } = req.body as {
      type: ViolationType;
      description?: string;
      metadata?: Record<string, unknown>;
    };

    const violation = await prisma.violation.create({
      data: {
        session_id: studentSession.id,
        type,
        description: description ?? null,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
      select: { id: true, type: true, occurred_at: true },
    });

    const warningsCount = await prisma.violation.count({
      where: { session_id: studentSession.id },
    });

    res.status(201).json({
      status: 'success',
      data: {
        violation,
        warningsCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/v1/exam-session/:token/submit ────────────────────────────────────
// Authenticated by validateStudentSession (Bearer session token).
// Marks the session SUBMITTED (atomic, race-safe), then grades every answer
// in the session and returns the final result summary.

export const submitSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { studentSession } = req as AuthenticatedStudentRequest;

    // Atomic guard: only an IN_PROGRESS session can transition to SUBMITTED,
    // so a double-submit (or autosubmit race) cannot grade twice.
    const closed = await prisma.examSession.updateMany({
      where: {
        id: studentSession.id,
        status: SubmissionStatus.IN_PROGRESS,
      },
      data: {
        status: SubmissionStatus.SUBMITTED,
        submitted_at: new Date(),
      },
    });

    if (closed.count === 0) {
      const current = await prisma.examSession.findUnique({
        where: { id: studentSession.id },
        select: { status: true },
      });

      res.status(409).json({
        status: 'error',
        message: `Cannot submit — session is already ${(current?.status ?? 'closed').toLowerCase()}`,
      });
      return;
    }

    // Grade every answer of this session (persists total_score + percentage).
    const result = await gradeSubmission(studentSession.examId, studentSession.id);

    const percentage =
      result.totalMarks > 0 ? (result.score / result.totalMarks) * 100 : 0;

    res.json({
      status: 'success',
      data: {
        result: {
          sessionId: result.sessionId,
          score: result.score,
          totalMarks: result.totalMarks,
          percentage: Math.round(percentage * 100) / 100,
          correctAnswers: result.correctAnswers,
          totalQuestions: result.totalQuestions,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
