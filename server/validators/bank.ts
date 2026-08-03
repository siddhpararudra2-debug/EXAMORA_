import { z } from 'zod';
import {
  questionBaseSchema,
  questionRefinements,
} from './exam.js';

/**
 * E16 — teacher question bank.
 * Same question shape as exam creation, plus an optional explanation
 * (which the AI generator / document parser already produces).
 */
export const saveBankQuestionSchema = questionBaseSchema
  .extend({
    explanation: z.string().max(2000).optional(),
  })
  .superRefine(questionRefinements);

export type BankQuestionInput = z.infer<typeof saveBankQuestionSchema>;
