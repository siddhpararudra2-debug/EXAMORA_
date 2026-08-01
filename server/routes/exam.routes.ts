import { Router } from 'express';
import multer from 'multer';

import { requireTeacher } from '../middleware/auth.js';
import {
  createExam,
  listExams,
  getStudentView,
  getExamStatus,
  submitExam,
  gradeAllSessions,
  deleteExam,
  publishExam,
  getSessionEvents,
} from '../controllers/exam.controller.js';
import { inviteBulkStudents } from '../../apps/backend/src/controllers/invite.controller.js';
import { generateAIQuestions } from '../../apps/backend/src/controllers/ai.controller.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

/**
 * POST /api/exams/generate-questions
 * TASK 3: AI Question Generator backend route (Groq SDK llama-3.3-70b-versatile).
 * Protected — valid teacher JWT required.
 */
router.post('/generate-questions', requireTeacher, generateAIQuestions);

/**
 * GET /api/exams
 * List the authenticated teacher's exams.
 * Protected — valid teacher JWT required.
 */
router.get('/', requireTeacher, listExams);

/**
 * POST /api/exams
 * Create a new exam with questions.
 * Protected — valid teacher JWT required.
 */
router.post('/', requireTeacher, createExam);

/**
 * GET /api/exams/:id/status
 * Check whether an exam exists and is joinable.
 * Public — used by the student join page.
 */
router.get('/:id/status', getExamStatus);

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
 * GET /api/exams/:examId/sessions/:sessionId/events
 * TASK 1 Step 3: Fetch all ProctoringEvents for that session ordered by timestamp ascending.
 * Protected — valid teacher JWT required (owner only).
 */
router.get('/:examId/sessions/:sessionId/events', requireTeacher, getSessionEvents);

/**
 * POST /api/exams/:examId/invite-bulk
 * TASK 2 Step 3: Bulk Student Email Invite System (CSV parse + Nodemailer send).
 * Protected — valid teacher JWT required (owner only).
 */
router.post('/:examId/invite-bulk', requireTeacher, upload.single('file'), inviteBulkStudents);

/**
 * POST /api/exams/:id/grade-all
 * Grade every SUBMITTED session of an exam.
 * Protected — valid teacher JWT required (owner only).
 */
router.post('/:id/grade-all', requireTeacher, gradeAllSessions);

/**
 * POST /api/exams/:id/publish
 * Publish a DRAFT exam so students can join it.
 * Protected — valid teacher JWT required (owner only).
 */
router.post('/:id/publish', requireTeacher, publishExam);

/**
 * DELETE /api/exams/:id
 * Delete an exam and all its data.
 * Protected — valid teacher JWT required (owner only).
 */
router.delete('/:id', requireTeacher, deleteExam);

export default router;
