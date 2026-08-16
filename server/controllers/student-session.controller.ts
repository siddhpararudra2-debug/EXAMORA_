import { Request, Response, NextFunction } from 'express';
import { Prisma, SubmissionStatus, ViolationType } from '@prisma/client';
import { Server } from 'socket.io';

import { AuthenticatedStudentRequest } from '../middleware/validateStudentSession.js';
import { gradeSubmission } from '../../packages/database/src/grading.service.js';
import { normalizeExamSettings } from '../../packages/database/src/shuffle.service.js';
import {
  MAX_WARNINGS,
  roomName,
  sessionRoomName,
  PROCTORING_EVENTS,
} from '../../apps/backend/src/socket/proctoring.handler.js';
import prisma from '../../prisma/client.js';

export { MAX_WARNINGS };

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
// Inserts a proctoring violation for the session, enforces the 3-warning rule,
// updates status to TERMINATED if warnings >= 3, and broadcasts status update
// to the teacher live monitoring room via Socket.io.

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

    // 1. Create Violation record in DB
    const violation = await prisma.violation.create({
      data: {
        session_id: studentSession.id,
        type: type || ViolationType.TAB_SWITCH,
        description: description ?? null,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
      select: { id: true, type: true, occurred_at: true },
    });

    // 2. Resolve the exam policy and count total warnings for the session.
    const exam = await prisma.exam.findUnique({
      where: { id: studentSession.examId, deleted_at: null },
      select: { settings: true },
    });
    const warningsLimit =
      normalizeExamSettings(exam?.settings).warningThreshold ?? MAX_WARNINGS;
    const warningsCount = await prisma.violation.count({
      where: { session_id: studentSession.id },
    });

    const terminated = warningsCount >= warningsLimit;

    // 3. Enforce the configured warning termination rule
    if (terminated) {
      await prisma.examSession.updateMany({
        where: {
          id: studentSession.id,
          status: SubmissionStatus.IN_PROGRESS,
        },
        data: {
          status: SubmissionStatus.TERMINATED,
          submitted_at: new Date(),
        },
      });
    }

    // 4. Broadcast update to teacher live monitoring room via Socket.io
    const io = (req.app as any).io as Server | null;
    if (io) {
      const sessionDetails = await prisma.examSession.findUnique({
        where: { id: studentSession.id },
        select: {
          student_name: true,
          student_email: true,
          enrollment_number: true,
          status: true,
        },
      });

      const examRoom = roomName(studentSession.examId);

      // Broadcast student_status_update to teacher dashboard
      io.to(examRoom).emit(PROCTORING_EVENTS.STUDENT_STATUS_UPDATE, {
        examId: studentSession.examId,
        sessionId: studentSession.id,
        studentName: sessionDetails?.student_name ?? 'Student',
        studentEmail: sessionDetails?.student_email ?? '',
        enrollmentNo: sessionDetails?.enrollment_number ?? '',
        status: terminated ? SubmissionStatus.TERMINATED : SubmissionStatus.IN_PROGRESS,
        warnings: warningsCount,
        warningsLimit,

        terminated,
        submitted: false,
        timestamp: new Date().toISOString(),
        reason: description ?? type,
      });

      // If session is terminated, emit exam_terminated event ONLY to per-session room
      if (terminated) {
        const studentSessionRoom = sessionRoomName(studentSession.id);
        io.to(studentSessionRoom).emit(PROCTORING_EVENTS.EXAM_TERMINATED, {
          examId: studentSession.examId,
          sessionId: studentSession.id,
          reason: description ?? 'warnings_limit',
          warnings: warningsCount,
          warningsLimit,

        });
      }
    }

    res.status(201).json({
      status: 'success',
      data: {
        violation,
        warningsCount,
        terminated,
        maxWarnings: warningsLimit,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/v1/exam-session/:token/submit ────────────────────────────────────
// Authenticated by validateStudentSession (Bearer session token).
// Marks the session SUBMITTED (atomic, race-safe), then grades every answer
// in the session and returns the final result summary. Broadcasts update to teacher.

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

    // Broadcast status update to teacher monitoring room via Socket.io
    const io = (req.app as unknown as { io?: Server }).io;
    if (io) {
      const sessionDetails = await prisma.examSession.findUnique({
        where: { id: studentSession.id },
        select: {
          student_name: true,
          student_email: true,
          enrollment_number: true,
        },
      });

      const [warningsCount, exam] = await Promise.all([
        prisma.violation.count({ where: { session_id: studentSession.id } }),
        prisma.exam.findUnique({
          where: { id: studentSession.examId, deleted_at: null },
          select: { settings: true },
        }),
      ]);
      const warningsLimit =
        normalizeExamSettings(exam?.settings).warningThreshold ?? MAX_WARNINGS;

      io.to(roomName(studentSession.examId)).emit('student_status_update', {
        examId: studentSession.examId,
        sessionId: studentSession.id,
        studentName: sessionDetails?.student_name ?? 'Student',
        studentEmail: sessionDetails?.student_email ?? '',
        enrollmentNo: sessionDetails?.enrollment_number ?? '',
        status: SubmissionStatus.SUBMITTED,
        warnings: warningsCount,
        warningsLimit,

        terminated: false,
        submitted: true,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      status: 'success',
      data: {
        message: 'Exam submitted successfully',
        submittedAt: new Date().toISOString(),
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
