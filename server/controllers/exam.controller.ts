import { Request, Response, NextFunction } from 'express';
import { PrismaClient, SessionStatus, ExamStatus } from '@prisma/client';
import { ZodType, ZodTypeDef } from 'zod';

import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  createExamSchema,
  submitExamSchema,
  CreateExamInput,
  SubmitExamInput,
} from '../validators/exam.js';
import {
  createExamWithQuestions,
  getExamForStudent,
  recordSubmissions,
} from '../../packages/database/src/exam.service.js';
import { gradeAllSubmissionsForExam } from '../../packages/database/src/grading.service.js';

const prisma = new PrismaClient();

// ── Shared validation helper ──────────────────────────────────────────────────

function validate<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    return { success: false, error: message };
  }
  return { success: true, data: result.data };
}

// ── POST /api/exams ───────────────────────────────────────────────────────────
// Protected: requires valid teacher JWT (applied at the router level).
//
// Body: CreateExamInput — { title, description?, durationMinutes, totalMarks,
//                           status?, questions[] }
// Returns 201 with the created Exam (without question answers).

export const createExam = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;

    const parsed = validate<CreateExamInput>(createExamSchema, req.body);
    if (!parsed.success) {
      res.status(400).json({ status: 'error', message: parsed.error });
      return;
    }

    const { questions, ...examData } = parsed.data;

    const exam = await createExamWithQuestions(teacher.userId, examData, questions);

    res.status(201).json({
      status: 'success',
      data: { exam },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/exams/:id/student-view ──────────────────────────────────────────
// Public route — no teacher auth.
// Requires a valid `sessionToken` in query-string OR x-session-token header.
// Returns exam details + questions WITHOUT correctAnswer fields.

export const getStudentView = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: examId } = req.params;

    // Accept token from header or query string
    const sessionToken =
      (req.headers['x-session-token'] as string | undefined) ??
      (req.query.sessionToken as string | undefined);

    if (!sessionToken) {
      res.status(401).json({
        status: 'error',
        message:
          'sessionToken is required (x-session-token header or ?sessionToken query param)',
      });
      return;
    }

    // Validate the session belongs to this exam and is still active
    const session = await prisma.studentSession.findFirst({
      where: { sessionToken, examId },
    });

    if (!session) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid or expired session token for this exam',
      });
      return;
    }

    if (session.status === SessionStatus.SUBMITTED || session.status === SessionStatus.TERMINATED) {
      res.status(403).json({
        status: 'error',
        message: `Exam session is already ${session.status.toLowerCase()}`,
      });
      return;
    }

    // Fetch exam + questions (correctAnswer is excluded in the service)
    const exam = await getExamForStudent(examId);
    if (!exam) {
      res.status(404).json({ status: 'error', message: 'Exam not found' });
      return;
    }

    if (exam.status !== ExamStatus.ACTIVE) {
      res.status(400).json({
        status: 'error',
        message: 'Exam is not currently active',
      });
      return;
    }

    res.json({
      status: 'success',
      data: {
        exam,
        session: {
          id: session.id,
          studentName: session.studentName,
          startedAt: session.startedAt,
          warningsCount: session.warningsCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/exams/:id/submit ────────────────────────────────────────────────
// Public route — no teacher auth.
// Body: SubmitExamInput — { sessionToken, answers: [{ questionId, answerText }] }
// Saves all submissions, marks session as SUBMITTED, records submittedAt.

export const submitExam = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: examId } = req.params;

    const parsed = validate<SubmitExamInput>(submitExamSchema, req.body);
    if (!parsed.success) {
      res.status(400).json({ status: 'error', message: parsed.error });
      return;
    }

    const { sessionToken, answers } = parsed.data;

    // Validate session
    const session = await prisma.studentSession.findFirst({
      where: { sessionToken, examId },
    });

    if (!session) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid session token for this exam',
      });
      return;
    }

    if (session.status !== SessionStatus.ACTIVE) {
      res.status(400).json({
        status: 'error',
        message: `Cannot submit — session is already ${session.status.toLowerCase()}`,
      });
      return;
    }

    // Validate all submitted questionIds belong to this exam
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: { select: { id: true } } },
    });

    if (!exam) {
      res.status(404).json({ status: 'error', message: 'Exam not found' });
      return;
    }

    const validQuestionIds = new Set(exam.questions.map((q) => q.id));
    const invalidIds = answers
      .map((a) => a.questionId)
      .filter((qId) => !validQuestionIds.has(qId));

    if (invalidIds.length > 0) {
      res.status(400).json({
        status: 'error',
        message: `Invalid questionId(s): ${invalidIds.join(', ')}`,
      });
      return;
    }

    // Persist submissions + mark session SUBMITTED in a single transaction
    await prisma.$transaction(async (tx) => {
      // Write answers (skipDuplicates handles accidental re-submission of same Q)
      await tx.submission.createMany({
        data: answers.map(({ questionId, answerText }) => ({
          sessionId: session.id,
          questionId,
          answerText,
        })),
        skipDuplicates: true,
      });

      // Close the session
      await tx.studentSession.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });
    });

    res.json({
      status: 'success',
      data: {
        message: 'Exam submitted successfully',
        submittedAt: new Date().toISOString(),
        answersRecorded: answers.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/exams/:id/grade-all ─────────────────────────────────────────────
// Protected: requires valid teacher JWT (applied at the router level).
// Grades every SUBMITTED session of the exam and persists score + GRADED status.

export const gradeAllSessions = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { id: examId } = req.params;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, createdBy: true },
    });

    if (!exam) {
      res.status(404).json({ status: 'error', message: 'Exam not found' });
      return;
    }

    if (exam.createdBy !== teacher.userId) {
      res.status(403).json({
        status: 'error',
        message: 'You do not have access to this exam',
      });
      return;
    }

    const gradedSessions = await gradeAllSubmissionsForExam(examId);

    res.json({
      status: 'success',
      data: {
        message: `${gradedSessions.length} session(s) graded`,
        gradedSessions,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/exams ────────────────────────────────────────────────────────────
// Protected: requires valid teacher JWT (applied at the router level).
// Returns the authenticated teacher's exams with session counts.

export const listExams = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;

    const exams = await prisma.exam.findMany({
      where: { createdBy: teacher.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true, sessions: true } },
      },
    });

    res.json({
      status: 'success',
      data: { exams },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/exams/:id/status ─────────────────────────────────────────────────
// Public route — no teacher auth. Used by the student join page to verify an
// exam exists and is joinable before showing the join form.

export const getExamStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: examId } = req.params;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true, status: true },
    });

    if (!exam) {
      res.status(404).json({
        status: 'error',
        message: 'Exam not found',
      });
      return;
    }

    res.json({
      status: 'success',
      data: { exam },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/exams/:id/publish ───────────────────────────────────────────────
// Protected: requires valid teacher JWT (applied at the router level). Owner only.
// Transitions a DRAFT exam to ACTIVE so students can join it.

export const publishExam = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { id: examId } = req.params;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true, status: true, createdBy: true },
    });

    if (!exam) {
      res.status(404).json({ status: 'error', message: 'Exam not found' });
      return;
    }

    if (exam.createdBy !== teacher.userId) {
      res.status(403).json({
        status: 'error',
        message: 'You do not have access to this exam',
      });
      return;
    }

    if (exam.status === 'COMPLETED') {
      res.status(409).json({
        status: 'error',
        message: 'Completed exams cannot be republished',
      });
      return;
    }

    if (exam.status === 'ACTIVE') {
      res.json({
        status: 'success',
        data: { exam: { id: exam.id, status: exam.status } },
      });
      return;
    }

    const published = await prisma.exam.update({
      where: { id: examId },
      data: { status: 'ACTIVE' },
      select: { id: true, status: true },
    });

    res.json({ status: 'success', data: { exam: published } });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/exams/:id ─────────────────────────────────────────────────────
// Protected: requires valid teacher JWT (applied at the router level).
// Deletes the exam and its questions/sessions/submissions (cascade). Owner only.

export const deleteExam = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { id: examId } = req.params;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, createdBy: true },
    });

    if (!exam) {
      res.status(404).json({ status: 'error', message: 'Exam not found' });
      return;
    }

    if (exam.createdBy !== teacher.userId) {
      res.status(403).json({
        status: 'error',
        message: 'You do not have access to this exam',
      });
      return;
    }

    await prisma.exam.delete({ where: { id: examId } });

    res.json({
      status: 'success',
      data: { message: 'Exam deleted successfully' },
    });
  } catch (err) {
    next(err);
  }
};
