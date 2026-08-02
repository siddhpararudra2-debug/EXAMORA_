import { z } from 'zod';

// ── Route params ───────────────────────────────────────────────────────────────

/** The session token in `/api/v1/exam-session/:token/...` */
export const sessionTokenParamSchema = z.object({
  token: z.string().uuid('Session token must be a valid UUID'),
});

// ── Save answer ────────────────────────────────────────────────────────────────

export const saveAnswerSchema = z.object({
  questionId: z.string().uuid('questionId must be a valid UUID'),
  answerData: z
    .string()
    .max(10_000, 'Answer is too long (max 10,000 characters)'),
});

// ── Report violation ───────────────────────────────────────────────────────────

export const violationSchema = z.object({
  type: z.enum([
    'TAB_SWITCH',
    'APP_SWITCH',
    'MINIMIZE',
    'MOBILE_BUTTON',
    'AI_OVERLAY',
    'DEVTOOLS',
    'SCREEN_CAPTURE',
    'KEYBOARD_SHORTCUT',
  ]),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ── Inferred types ─────────────────────────────────────────────────────────────

export type SessionTokenParams = z.infer<typeof sessionTokenParamSchema>;
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
export type ViolationInput = z.infer<typeof violationSchema>;
