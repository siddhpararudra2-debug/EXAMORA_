import { Router } from 'express';

import { requireTeacher } from '../middleware/auth.js';
import { validateBody } from '../middleware/security.js';
import { saveBankQuestionSchema } from '../validators/bank.js';
import {
  listBankQuestions,
  saveBankQuestion,
  deleteBankQuestion,
} from '../controllers/bank.controller.js';

const router = Router();

/**
 * GET /api/v1/question-bank
 * List the teacher's saved questions. Protected — teacher JWT.
 */
router.get('/', requireTeacher, listBankQuestions);

/**
 * POST /api/v1/question-bank
 * Save one question to the teacher's bank. Protected — teacher JWT.
 */
router.post(
  '/',
  requireTeacher,
  validateBody(saveBankQuestionSchema),
  saveBankQuestion,
);

/**
 * DELETE /api/v1/question-bank/:id
 * Remove a saved question. Protected — teacher JWT (owner only).
 */
router.delete('/:id', requireTeacher, deleteBankQuestion);

export default router;
