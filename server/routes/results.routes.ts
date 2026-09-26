import { Router } from 'express';
import { requireTeacher } from '../middleware/auth.js';
import {
  declareExamResults,
  downloadSessionMarksheet,
  emailSessionScorecard,
  exportExamResultsCsv,
} from '../controllers/results.controller.js';

const router = Router();

/**
 * POST /api/v1/exams/:examId/declare-results
 * Grade remaining sessions, mark the exam COMPLETED, and email every
 * student their marksheet (PDF). Protected — teacher JWT required (owner only).
 */
router.post('/exams/:examId/declare-results', requireTeacher, declareExamResults);

/**
 * GET /api/v1/exams/:examId/results/export
 * Download the full results sheet as CSV. Protected — teacher JWT required (owner only).
 */
router.get('/exams/:examId/results/export', requireTeacher, exportExamResultsCsv);

/**
 * GET /api/v1/exams/:examId/sessions/:sessionId/marksheet
 * Download one student's marksheet PDF. Protected — teacher JWT required (owner only).
 */
router.get('/exams/:examId/sessions/:sessionId/marksheet', requireTeacher, downloadSessionMarksheet);

/**
 * POST /api/v1/exams/:examId/sessions/:sessionId/scorecard/email
 * Email one student's marksheet PDF to their own address. Protected — teacher JWT required (owner only).
 */
router.post('/exams/:examId/sessions/:sessionId/scorecard/email', requireTeacher, emailSessionScorecard);

export default router;
