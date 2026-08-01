import { Router } from 'express';

import { requireTeacher } from '../middleware/auth.js';
import {
  createExam,
  getStudentView,
  submitExam,
  gradeAllSessions,
} from '../controllers/exam.controller.js';

const router = Router();

/**
 * POST /api/exams
 * Create a new exam with questions.
 * Protected — valid teacher JWT required.
 */
router.post('/', requireTeacher, createExam);

/**
 * GET /api/exams/:id/student-view
 * Fetch exam details + questions (no correct answers).
 * Public — requires a valid sessionToken in x-session-token header or ?sessionToken query param.
 */
router.get('/:id/student-view', getStudentView);

/**
 * POST /api/exams/:id/submit
 * Submit answers for an exam session.
 * Public — requires a valid sessionToken in the request body.
 */
router.post('/:id/submit', submitExam);

/**
 * POST /api/exams/:id/grade-all
 * Grade every SUBMITTED session of an exam.
 * Protected — valid teacher JWT required (owner only).
 */
router.post('/:id/grade-all', requireTeacher, gradeAllSessions);

export default router;
