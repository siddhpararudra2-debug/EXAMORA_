import { Router } from 'express';
import { requireTeacher } from '../middleware/auth.js';
import { declareExamResults, downloadSessionMarksheet } from '../controllers/results.controller.js';

const router = Router();

/**
 * POST /api/v1/exams/:examId/declare-results
 * Grade remaining sessions, mark the exam COMPLETED, and email every
 * student their marksheet (PDF). Protected — teacher JWT required (owner only).
 */
router.post('/exams/:examId/declare-results', requireTeacher, declareExamResults);

/**
 * GET /api/v1/exams/:examId/sessions/:sessionId/marksheet
 * Download one student's marksheet PDF. Protected — teacher JWT required (owner only).
 */
router.get('/exams/:examId/sessions/:sessionId/marksheet', requireTeacher, downloadSessionMarksheet);

export default router;
