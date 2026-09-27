import { Request, Response, NextFunction } from 'express';
import { ExamStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { gradeAllSubmissionsForExam, GRADED_STATUSES } from '../../packages/database/src/grading.service.js';
import { dispatchResults, buildMarksheetPdf, sendSingleMarksheet } from '../../apps/backend/src/services/emailDispatcher.js';
import prisma from '../../prisma/client.js';

/**
 * GET /api/v1/exams/:examId/sessions/:sessionId/marksheet
 * Protected — valid teacher JWT required (owner only).
 *
 * Streams one student's marksheet as a PDF attachment. Same generator used by
 * the bulk email dispatcher, so a downloaded sheet is byte-identical to the
 * emailed one.
 */
export const downloadSessionMarksheet = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { examId, sessionId } = req.params;

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

    const marksheet = await buildMarksheetPdf(examId, sessionId);

    if (!marksheet) {
      res.status(404).json({
        status: 'error',
        message: 'Session not found or not yet graded',
      });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${marksheet.filename}"`);
    res.setHeader('Content-Length', String(marksheet.pdfBuffer.length));
    res.send(marksheet.pdfBuffer);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/exams/:examId/sessions/:sessionId/scorecard/email
 * Protected — valid teacher JWT required (owner only).
 *
 * Emails one student's marksheet PDF to their own address (reuses the bulk
 * Nodemailer setup). Response shape follows spec §6.6 exactly.
 */
export const emailSessionScorecard = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { examId, sessionId } = req.params;

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

    const session = await prisma.examSession.findFirst({
      where: { id: sessionId, exam_id: examId },
      select: { id: true },
    });
    if (!session) {
      res.status(404).json({ status: 'error', message: 'Session not found' });
      return;
    }

    try {
      const { sentTo } = await sendSingleMarksheet(examId, sessionId);
      res.json({ status: 'success', data: { sentTo } });
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'SCORECARD_UNAVAILABLE') {
        res.status(404).json({
          status: 'error',
          message: 'Session not found or not yet graded',
        });
        return;
      }
      if (code === 'SCORECARD_NO_EMAIL') {
        res.status(400).json({
          status: 'error',
          message: 'Student has no email address on record',
        });
        return;
      }
      if (code === 'SCORECARD_SEND_FAILED') {
        res.status(502).json({
          status: 'error',
          message: 'Email delivery failed — try again later',
        });
        return;
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/exams/:examId/results/export
 * Protected — valid teacher JWT required (owner only).
 *
 * Streams the exam's results as a downloadable CSV (Excel-compatible, BOM
 * prefixed). One row per graded session with summary columns plus one
 * "Answer / Correct / Marks" triplet per question.
 */
export const exportExamResultsCsv = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { examId } = req.params;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true, total_marks: true, created_by: true },
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
              final_score: true,
              needs_review: true,
            },
            orderBy: { created_at: 'asc' },
          },
        },
        orderBy: { student_name: 'asc' },
      }),
      prisma.question.findMany({
        where: { exam_id: examId },
        select: { id: true, question_text: true, marks: true },
        orderBy: { order_index: 'asc' },
      }),
    ]);

    const csv = buildResultsCsv(exam.title, exam.total_marks, questions, sessions);

    const safeTitle = exam.title.replace(/[^\w\s-]/g, '').trim() || 'exam';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle}_results.csv"`,
    );
    res.send(`\ufeff${csv}`);
  } catch (err) {
    next(err);
  }
};

interface CsvQuestion {
  id: string;
  question_text: string;
  marks: number;
}

interface CsvSession {
  student_name: string;
  enrollment_number: string | null;
  student_email: string | null;
  status: string;
  submitted_at: Date | null;
  total_score: import('@prisma/client').Prisma.Decimal | null;
  percentage: import('@prisma/client').Prisma.Decimal | null;
  answers: {
    question_id: string;
    answer_text: string;
    is_correct: boolean | null;
    marks_awarded: import('@prisma/client').Prisma.Decimal | null;
    /** P2-6 educator override — takes precedence over marks_awarded. */
    final_score: import('@prisma/client').Prisma.Decimal | null;
    needs_review: boolean;
  }[];
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildResultsCsv(
  examTitle: string,
  maxMarks: number,
  questions: CsvQuestion[],
  sessions: CsvSession[],
): string {
  const header = [
    'Student Name',
    'Enrollment No',
    'Email',
    'Status',
    'Submitted At',
    'Score',
    'Max Marks',
    'Percentage',
    'Needs Review',
    ...questions.flatMap((q, i) => [
      `Q${i + 1} Answer`,
      `Q${i + 1} Correct`,
      `Q${i + 1} Marks`,
    ]),
  ];

  const rows = sessions.map((session) => {
    const answerByQuestion = new Map(
      session.answers.map((a) => [a.question_id, a]),
    );
    const score = session.total_score !== null ? Number(session.total_score) : '';
    const percentage = session.percentage !== null ? Number(session.percentage) : '';
    const needsReview = session.answers.some((a) => a.needs_review)
      ? 'YES'
      : '';

    return [
      session.student_name,
      session.enrollment_number ?? '',
      session.student_email ?? '',
      session.status,
      session.submitted_at?.toISOString() ?? '',
      score,
      maxMarks,
      percentage,
      needsReview,
      ...questions.flatMap((q) => {
        const answer = answerByQuestion.get(q.id);
        // P2-6 fallback chain: educator override wins over the auto/AI score.
        const effective =
          answer?.final_score !== null && answer?.final_score !== undefined
            ? Number(answer.final_score)
            : answer?.marks_awarded !== null && answer?.marks_awarded !== undefined
              ? Number(answer.marks_awarded)
              : '';
        return [
          answer?.answer_text ?? '',
          answer?.is_correct === null || answer?.is_correct === undefined
            ? ''
            : answer.is_correct
            ? 'YES'
            : 'NO',
          effective,
        ];
      }),
    ];
  });

  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/**
 * POST /api/v1/exams/:examId/declare-results
 * Protected — valid teacher JWT required (owner only).
 *
 * Finalizes an exam's results:
 *  1. Grades every ungraded SUBMITTED / AUTO_SUBMITTED session.
 *  2. Marks the exam COMPLETED.
 *  3. Generates PDF marksheets and emails them to each student
 *     (via the email dispatcher; mocked in dev without SMTP creds).
 */
export const declareExamResults = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { examId } = req.params;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true, status: true, created_by: true },
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

    // 1. Grade all ungraded submitted sessions (idempotent — re-grading
    //    overwrites total_score/percentage with the same values).
    const gradedSessions = await gradeAllSubmissionsForExam(examId);

    // 2. Mark the exam as COMPLETED (completed_at starts the 90-day
    // violation-metadata retention clock — see server/jobs/retention.purge.ts)
    if (exam.status !== ExamStatus.COMPLETED) {
      await prisma.exam.update({
        where: { id: examId },
        data: { status: ExamStatus.COMPLETED, completed_at: new Date() },
      });
    }

    // 3. Dispatch marksheet emails (logs every send into email_log)
    const dispatch = await dispatchResults(examId);

    res.json({
      status: 'success',
      data: {
        message: `Results declared for ${dispatch.total} student(s)`,
        exam: { id: exam.id, title: exam.title, status: ExamStatus.COMPLETED },
        graded: gradedSessions.length,
        dispatch: {
          total: dispatch.total,
          sent: dispatch.sent,
          failed: dispatch.failed,
          skipped: dispatch.skipped,
          errors: dispatch.errors,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
