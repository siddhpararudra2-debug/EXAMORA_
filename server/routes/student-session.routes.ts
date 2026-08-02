import { Router } from 'express';
import { SubmissionStatus } from '@prisma/client';

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
 * Accepts TERMINATED sessions so a closed session can still flush its
 * last in-memory answers before the student is redirected.
 */
router.post(
  '/:token/answer',
  validateParams(sessionTokenParamSchema),
  validateStudentSession([
    SubmissionStatus.IN_PROGRESS,
    SubmissionStatus.TERMINATED,
  ]),
  validateBody(saveAnswerSchema),
  saveAnswer,
);

/**
 * POST /api/v1/exam-session/:token/violation
 * Report a proctoring violation for the active session.
 * Public — authenticated by the anonymous Bearer session token.
 * IN_PROGRESS sessions only.
 */
router.post(
  '/:token/violation',
  validateParams(sessionTokenParamSchema),
  validateStudentSession(),
  validateBody(violationSchema),
  reportViolation,
);

/**
 * POST /api/v1/exam-session/:token/submit
 * Submit the session, grade all answers, and return the result summary.
 * Public — authenticated by the anonymous Bearer session token.
 * IN_PROGRESS sessions only.
 */
router.post(
  '/:token/submit',
  validateParams(sessionTokenParamSchema),
  validateStudentSession(),
  submitSession,
);

export default router;
