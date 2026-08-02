import { Router } from 'express';
import multer from 'multer';

import { requireTeacher } from '../middleware/auth.js';
import { validateBody } from '../middleware/security.js';
import {
  createExam,
  listExams,
  getStudentView,
  getExamStatus,
  submitExam,
  gradeAllSessions,
  deleteExam,
  publishExam,
  unpublishExam,
  getSessionEvents,
  getExamResults,
} from '../controllers/exam.controller.js';
import { generateAIQuestions } from '../../apps/backend/src/controllers/ai.controller.js';
import { inviteBulkStudents } from '../../apps/backend/src/controllers/invite.controller.js';
import { logProctoringEvent } from '../../apps/backend/src/controllers/proctoring.controller.js';
import {
  createExamSchema,
  submitExamSchema,
  aiGenerateSchema,
  proctoringEventSchema,
} from '../validators/exam.js';

const router = Router();

/**
 * POST /api/exams
 * Create a new exam with questions.
 * Protected — valid teacher JWT required.
 */
router.post('/', requireTeacher, validateBody(createExamSchema), createExam);

/**
 * GET /api/exams
 * List the authenticated teacher's exams.
 * Protected — valid teacher JWT required.
 */
router.get('/', requireTeacher, listExams);

/**
 * POST /api/exams/generate-questions
 * Generate exam questions via Groq AI (free tier) with a built-in fallback.
 * Protected — valid teacher JWT required.
 */
router.post(
  '/generate-questions',
  requireTeacher,
  validateBody(aiGenerateSchema),
  generateAIQuestions,
);

/**
 * POST /api/exams/:examId/invite-bulk
 * Bulk-invite students from a CSV upload (field: "file") or JSON
 * (body: { students: [...] }). Emails each student a personalized join link.
 * Protected — valid teacher JWT required (owner only).
 */
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
router.post(
  '/:examId/invite-bulk',
  requireTeacher,
  csvUpload.single('file'),
  inviteBulkStudents,
);

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
router.post('/:id/submit', validateBody(submitExamSchema), submitExam);

/**
 * POST /api/exams/:id/proctoring-event
 * Persist a proctoring violation and enforce the 3-warning termination rule.
 * Public — requires a valid sessionToken in the request body.
 */
router.post(
  '/:id/proctoring-event',
  validateBody(proctoringEventSchema),
  logProctoringEvent,
);

/**
 * POST /api/exams/:id/publish
 * Publish a DRAFT exam so students can join it.
 * Protected — valid teacher JWT required (owner only).
 */
router.post('/:id/publish', requireTeacher, publishExam);

/**
 * POST /api/exams/:id/unpublish
 * Revert a published exam back to DRAFT status.
 * Protected — valid teacher JWT required (owner only).
 */
router.post('/:id/unpublish', requireTeacher, unpublishExam);

/**
 * POST /api/exams/:id/grade-all
 * Grade every SUBMITTED session of an exam.
 * Protected — valid teacher JWT required (owner only).
 */
router.post('/:id/grade-all', requireTeacher, gradeAllSessions);

/**
 * GET /api/exams/:examId/results
 * Fetch graded sessions + questions for the results dashboard.
 * Protected — valid teacher JWT required (owner only).
 */
router.get('/:examId/results', requireTeacher, getExamResults);

/**
 * GET /api/exams/:examId/sessions/:sessionId/events
 * Fetch the proctoring event timeline for one session.
 * Protected — valid teacher JWT required (owner only).
 */
router.get(
  '/:examId/sessions/:sessionId/events',
  requireTeacher,
  getSessionEvents,
);

/**
 * DELETE /api/exams/:id
 * Delete an exam and all its data.
 * Protected — valid teacher JWT required (owner only).
 */
router.delete('/:id', requireTeacher, deleteExam);

export default router;
