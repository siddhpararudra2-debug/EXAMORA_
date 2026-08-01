import { Request, Response, NextFunction } from 'express';
import { PrismaClient, ExamStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { gradeAllSubmissionsForExam } from '../../packages/database/src/grading.service.js';
import { dispatchResults } from '../../apps/backend/src/services/emailDispatcher.js';

const prisma = new PrismaClient();

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

    // 2. Mark the exam as COMPLETED
    if (exam.status !== ExamStatus.COMPLETED) {
      await prisma.exam.update({
        where: { id: examId },
        data: { status: ExamStatus.COMPLETED },
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
