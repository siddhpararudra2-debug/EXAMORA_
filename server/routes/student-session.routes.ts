import { Router } from 'express';

import { validateBody, validateParams } from '../middleware/security.js';
import { validateStudentSession } from '../middleware/validateStudentSession.js';
import {
  saveAnswer,
  reportViolation,
  submitSession,
} from '../controllers/student-session.controller.js';
import {
  sessionTokenParamSchema,
  saveAnswerSchema,
  violationSchema,
} from '../validators/student-session.js';

const router = Router();

/**
 * POST /api/v1/exam-session/:token/answer
 * Save or update a student's answer for the active session.
 * Public — authenticated by the anonymous Bearer session token.
 */
router.post(
  '/:token/answer',
  validateParams(sessionTokenParamSchema),
  validateStudentSession,
  validateBody(saveAnswerSchema),
  saveAnswer,
);

/**
 * POST /api/v1/exam-session/:token/violation
 * Report a proctoring violation for the active session.
 * Public — authenticated by the anonymous Bearer session token.
 */
router.post(
  '/:token/violation',
  validateParams(sessionTokenParamSchema),
  validateStudentSession,
  validateBody(violationSchema),
  reportViolation,
);

/**
 * POST /api/v1/exam-session/:token/submit
 * Submit the session, grade all answers, and return the result summary.
 * Public — authenticated by the anonymous Bearer session token.
 */
router.post(
  '/:token/submit',
  validateParams(sessionTokenParamSchema),
  validateStudentSession,
  submitSession,
);

export default router;
