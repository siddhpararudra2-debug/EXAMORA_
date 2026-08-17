import { Request, Response, NextFunction } from 'express';
import { SubmissionStatus, ExamStatus } from '@prisma/client';
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
  publishExamService,
  unpublishExamService,
} from '../../packages/database/src/exam.service.js';
import {
  normalizeExamSettings,
  shuffleQuestionsForStudent,
  newShuffleSeed,
} from '../../packages/database/src/shuffle.service.js';
import { gradeAllSubmissionsForExam, GRADED_STATUSES } from '../../packages/database/src/grading.service.js';
import prisma from '../../prisma/client.js';

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

// ── GET /api/exams/:id ────────────────────────────────────────────────────────
// Protected: requires valid teacher JWT. Returns full exam details + questions for editing/viewing.
export const getExamDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { id: examId } = req.params;

    const exam = await prisma.exam.findFirst({
      where: { id: examId, created_by: teacher.userId, deleted_at: null },
      include: {
        questions: {
          orderBy: { order_index: 'asc' },
        },
        _count: {
          select: { questions: true, sessions: true },
        },
      },
    });

    if (!exam) {
      res.status(404).json({ status: 'error', message: 'Exam not found' });
      return;
    }

    const [activeCount, completedCount] = await Promise.all([
      prisma.examSession.count({
        where: { exam_id: examId, status: SubmissionStatus.IN_PROGRESS },
      }),
      prisma.examSession.count({
        where: {
          exam_id: examId,
          status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.AUTO_SUBMITTED, SubmissionStatus.TERMINATED] },
        },
      }),
    ]);

    const examData = {
      id: exam.id,
      title: exam.title,
      description: exam.description ?? '',
      durationMinutes: exam.duration_minutes,
      totalMarks: exam.total_marks,
      status: exam.status,
      settings: exam.settings,
      accessUuid: exam.access_uuid,
      qrCodeUrl: exam.qr_code_url,
      questionsCount: exam._count.questions,
      sessionsCount: exam._count.sessions,
      activeSessionsCount: activeCount,
      completedSessionsCount: completedCount,
      questions: exam.questions.map((q) => ({
        id: q.id,
        type: q.type,
        questionText: q.question_text,
        options: q.options,
        correctAnswer: q.correct_answer,
        marks: q.marks,
        orderIndex: q.order_index,
      })),
    };

    res.json({
      status: 'success',
      data: { exam: examData },
      exam: examData,
      id: examData.id,
      title: examData.title,
      description: examData.description,
      durationMinutes: examData.durationMinutes,
      totalMarks: examData.totalMarks,
      settings: examData.settings,
      accessUuid: examData.accessUuid,
      qrCodeUrl: examData.qrCodeUrl,
      questionsCount: examData.questionsCount,
      sessionsCount: examData.sessionsCount,
      activeSessionsCount: examData.activeSessionsCount,
      completedSessionsCount: examData.completedSessionsCount,
      questions: examData.questions,
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/exams/:id ────────────────────────────────────────────────────────
// Protected: requires valid teacher JWT. Updates an existing draft exam.
export const updateExam = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { id: examId } = req.params;

    const parsed = validate<CreateExamInput>(createExamSchema, req.body);
    if (!parsed.success) {
      res.status(400).json({ status: 'error', message: parsed.error });
      return;
    }

    const existing = await prisma.exam.findFirst({
      where: { id: examId, created_by: teacher.userId, deleted_at: null },
      select: { id: true, status: true },
    });

    if (!existing) {
      res.status(404).json({ status: 'error', message: 'Exam not found' });
      return;
    }

    if (existing.status !== ExamStatus.DRAFT) {
      res.status(409).json({
        status: 'error',
        message: 'Only draft exams can be edited. Unpublish or duplicate this exam to make changes.',
      });
      return;
    }

    const { questions, ...examData } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      // Delete previous questions
      await tx.question.deleteMany({ where: { exam_id: examId } });

      return tx.exam.update({
        where: { id: examId },
        data: {
          title: examData.title,
          description: examData.description ?? null,
          duration_minutes: examData.durationMinutes,
          total_marks: examData.totalMarks,
          settings: examData.settings ? (examData.settings as any) : undefined,
          questions: {
            create: questions.map((q, idx) => ({
              type: q.type,
              question_text: q.questionText,
              options:
                q.options !== undefined && q.options !== null
                  ? (q.options as any)
                  : undefined,
              correct_answer: q.correctAnswer ?? null,
              marks: q.marks,
              order_index: idx + 1,
            })),
          },
        },
        include: { questions: true },
      });
    });

    res.json({
      status: 'success',
      data: { exam: updated },
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
    const session = await prisma.examSession.findFirst({
      where: { session_token: sessionToken, exam_id: examId },
    });

    if (!session) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid or expired session token for this exam',
      });
      return;
    }

    if (session.expires_at && new Date() > session.expires_at) {
      res.status(403).json({
        status: 'error',
        message: 'This session has expired — please contact your educator',
      });
      return;
    }

    if (session.status !== SubmissionStatus.IN_PROGRESS) {
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

    if (exam.end_time && new Date() > exam.end_time) {
      res.status(403).json({
        status: 'error',
        message: 'The exam window has ended',
      });
      return;
    }

    // E15 — deterministic per-student question/option shuffling. The seed is
    // persisted on the session the first time it is needed, so a page refresh
    // reproduces the exact same paper for this student.
    const settings = normalizeExamSettings(exam.settings);
    let seed = session.shuffle_seed;
    // Options-only shuffling also needs a stable per-session seed — otherwise
    // every student would derive the same option order from seed 0.
    const shufflingEnabled = settings.shuffleQuestions || settings.shuffleOptions;
    if (shufflingEnabled && seed === null) {
      seed = newShuffleSeed();
      await prisma.examSession.update({
        where: { id: session.id },
        data: { shuffle_seed: seed },
      });
    }
    const questions = shuffleQuestionsForStudent(
      exam.questions,
      settings,
      seed ?? 0,
    );

    const warningsCount = await prisma.violation.count({
      where: { session_id: session.id },
    });

    res.json({
      status: 'success',
      data: {
        exam: {
          ...exam,
          questions,
          warningsLimit: settings.warningThreshold ?? 3,
          // Only the fields needed by the student runtime are exposed — never answer keys or raw settings.
          settings: { supervision: settings.supervision },
        },
        session: {
          id: session.id,
          studentName: session.student_name,
          startedAt: session.started_at,
          warningsCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/exams/:id/submit (DEPRECATED) ───────────────────────────────────
/**
 * @deprecated Use POST /api/v1/exam-session/:token/submit (student-session.controller.ts) instead.
 * Canonical student submission route is now authenticated via Bearer session token.
 */
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
    const session = await prisma.examSession.findFirst({
      where: { session_token: sessionToken, exam_id: examId },
    });

    if (!session) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid session token for this exam',
      });
      return;
    }

    if (session.status !== SubmissionStatus.IN_PROGRESS) {
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
      await tx.answer.createMany({
        data: answers.map(({ questionId, answerText }) => ({
          session_id: session.id,
          question_id: questionId,
          answer_text: answerText,
        })),
        skipDuplicates: true,
      });

      // Close the session
      await tx.examSession.update({
        where: { id: session.id },
        data: {
          status: SubmissionStatus.SUBMITTED,
          submitted_at: new Date(),
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
      select: { id: true, created_by: true },
    });

    if (!exam) {
      res.status(404).json({ status: 'error', message: 'Exam not found' });
      return;
    }

    if (exam.created_by !== teacher.userId) {
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

    // Pagination: ?page=1&pageSize=20 (pageSize capped at 100). Responses
    // include total/totalPages so the UI can render pager controls.
    const page = Math.max(1, Number(req.query.page) || 1);
    const requestedSize = Number(req.query.pageSize) || 20;
    const pageSize = Math.min(100, Math.max(1, requestedSize));

    const where = { created_by: teacher.userId, deleted_at: null };

    const [exams, total] = await Promise.all([
      prisma.exam.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { questions: true, sessions: true } },
        },
      }),
      prisma.exam.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        exams,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      },
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
      where: { id: examId, deleted_at: null },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        duration_minutes: true,
        end_time: true,
        settings: true,
        _count: { select: { questions: true } },
      },
    });

    if (!exam) {
      res.status(404).json({
        status: 'error',
        message: 'Exam not found',
      });
      return;
    }

    const settings = normalizeExamSettings(exam.settings);
    const isJoinable =
      exam.status === ExamStatus.ACTIVE &&
      (!exam.end_time || new Date() <= exam.end_time);

    res.json({
      status: 'success',
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          status: exam.status,
          isJoinable,
          durationMinutes: exam.duration_minutes,
          endTime: exam.end_time,
          questionCount: exam._count.questions,
          warningsLimit: settings.warningThreshold ?? 3,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/exams/:id/publish ───────────────────────────────────────────────
// Protected: requires valid teacher JWT (applied at the router level). Owner only.
// Verifies DRAFT status and at least one question, generates unique access_uuid
// and QR code data URL, updates status to PUBLISHED inside a Prisma transaction.

export const publishExam = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { id: examId } = req.params;

    const result = await publishExamService(examId, teacher.userId);

    res.json({
      status: 'success',
      data: {
        access_uuid: result.access_uuid,
        shareable_link: result.shareable_link,
        qr_code_url: result.qr_code_url,
        exam: result.exam,
      },
    });
  } catch (err: any) {
    if (err.message === 'EXAM_NOT_FOUND') {
      res.status(404).json({ status: 'error', message: 'Exam not found' });
      return;
    }
    if (err.message === 'UNAUTHORIZED') {
      res.status(403).json({ status: 'error', message: 'You do not have access to this exam' });
      return;
    }
    if (err.message?.startsWith('INVALID_STATUS')) {
      res.status(400).json({ status: 'error', message: err.message.replace('INVALID_STATUS: ', '') });
      return;
    }
    if (err.message?.startsWith('NO_QUESTIONS')) {
      res.status(400).json({ status: 'error', message: err.message.replace('NO_QUESTIONS: ', '') });
      return;
    }
    next(err);
  }
};

// ── POST /api/exams/:id/unpublish ─────────────────────────────────────────────
// Protected: requires valid teacher JWT (applied at the router level). Owner only.
// Reverts an active or published exam back to DRAFT status and resets access_uuid.

export const unpublishExam = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { id: examId } = req.params;

    const updatedExam = await unpublishExamService(examId, teacher.userId);

    res.json({
      status: 'success',
      data: {
        message: 'Exam unpublished successfully and reset to draft status',
        exam: updatedExam,
      },
    });
  } catch (err: any) {
    if (err.message === 'EXAM_NOT_FOUND') {
      res.status(404).json({ status: 'error', message: 'Exam not found' });
      return;
    }
    if (err.message === 'UNAUTHORIZED') {
      res.status(403).json({ status: 'error', message: 'You do not have access to this exam' });
      return;
    }
    if (err.message?.startsWith('INVALID_STATUS')) {
      res.status(400).json({ status: 'error', message: err.message.replace('INVALID_STATUS: ', '') });
      return;
    }
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
      select: { id: true, created_by: true },
    });

    if (!exam) {
      res.status(404).json({ status: 'error', message: 'Exam not found' });
      return;
    }

    if (exam.created_by !== teacher.userId) {
      res.status(403).json({
        status: 'error',
        message: 'You do not have access to this exam',
      });
      return;
    }

    // Soft delete: sessions, questions and grades are retained for audit and
    // recovery (deleted_at column) instead of being cascaded away.
    await prisma.exam.update({
      where: { id: examId },
      data: { deleted_at: new Date(), status: ExamStatus.ARCHIVED },
    });

    res.json({
      status: 'success',
      data: { message: 'Exam deleted successfully' },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/exams/:examId/sessions/:sessionId/events ───────────────────────────
// Protected: requires valid teacher JWT (applied at router level).
// Returns all Violations for that session, ordered by occurred_at ascending.

export const getSessionEvents = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { examId, sessionId } = req.params;

    const session = await prisma.examSession.findFirst({
      where: { id: sessionId, exam_id: examId },
      include: {
        exam: {
          select: {
            created_by: true,
            title: true,
            duration_minutes: true,
            total_marks: true,
            settings: true,
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({ status: 'error', message: 'Student session not found' });
      return;
    }

    if (session.exam.created_by !== teacher.userId) {
      res.status(403).json({ status: 'error', message: 'Access denied' });
      return;
    }

    const [events, warningsCount] = await Promise.all([
      prisma.violation.findMany({
        where: { session_id: sessionId },
        orderBy: { occurred_at: 'asc' },
      }),
      prisma.violation.count({
        where: { session_id: sessionId },
      }),
    ]);

    const formattedEvents = events.map((ev) => ({
      id: ev.id,
      type: ev.type,
      occurred_at: ev.occurred_at.toISOString(),
      description: ev.description || (ev.metadata ? (typeof ev.metadata === 'string' ? ev.metadata : JSON.stringify(ev.metadata)) : `${ev.type} violation detected`),
    }));

    const sessionDetail = {
      id: session.id,
      examId: session.exam_id,
      examTitle: session.exam.title,
      studentName: session.student_name,
      studentEmail: session.student_email ?? '',
      enrollmentNo: session.enrollment_number ?? '',
      totalWarnings: warningsCount,
      warningsLimit: normalizeExamSettings(session.exam.settings).warningThreshold ?? 3,
      finalScore: session.total_score !== null && session.total_score !== undefined ? Number(session.total_score) : undefined,
      maxScore: session.exam.total_marks,
      sessionStatus: session.status,
      examStartTime: session.started_at.toISOString(),
      examDurationMinutes: session.exam.duration_minutes,
      events: formattedEvents,
    };

    res.json({
      status: 'success',
      data: {
        events: formattedEvents,
        session: { ...sessionDetail, status: session.status },
      },
      session: { ...sessionDetail, status: session.status },
      events: formattedEvents,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/exams/:examId/results ────────────────────────────────────────────
// Protected: requires valid teacher JWT (applied at router level). Owner only.
// Returns graded sessions (SUBMITTED / AUTO_SUBMITTED / TERMINATED) with
// per-question answers plus the question paper, so the results dashboard can
// render analytics, the distribution histogram and per-student answer sheets.

export const getExamResults = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { examId } = req.params;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true, created_by: true },
    });

    if (!exam) {
      res.status(404).json({ status: 'error', message: 'Exam not found' });
      return;
    }

    if (exam.created_by !== teacher.userId) {
      res.status(403).json({
        status: 'error',
        message: 'You do not have access to this exam',
      });
      return;
    }

    const [sessions, questions] = await Promise.all([
      prisma.examSession.findMany({
        where: { exam_id: examId, status: { in: GRADED_STATUSES } },
        select: {
          id: true,
          student_name: true,
          enrollment_number: true,
          student_email: true,
          status: true,
          submitted_at: true,
          total_score: true,
          percentage: true,
          answers: {
            select: {
              question_id: true,
              answer_text: true,
              is_correct: true,
              marks_awarded: true,
              needs_review: true,
            },
            orderBy: { created_at: 'asc' },
          },
        },
        orderBy: { student_name: 'asc' },
      }),
      prisma.question.findMany({
        where: { exam_id: examId },
        select: {
          id: true,
          question_text: true,
          type: true,
          marks: true,
          correct_answer: true,
          order_index: true,
        },
        orderBy: { order_index: 'asc' },
      }),
    ]);

    res.json({
      status: 'success',
      data: {
        exam: { id: exam.id, title: exam.title },
        questions,
        results: sessions.map((session) => ({
          id: session.id,
          studentName: session.student_name,
          enrollmentNumber: session.enrollment_number,
          email: session.student_email,
          status: session.status,
          submittedAt: session.submitted_at,
          totalScore: session.total_score !== null && session.total_score !== undefined ? Number(session.total_score) : null,
          percentage: session.percentage !== null && session.percentage !== undefined ? Number(session.percentage) : null,
          answers: session.answers,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};
