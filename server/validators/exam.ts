import { z } from 'zod';

// ── Enums mirror prisma/schema.prisma ────────────────────────────────────────

// ── Enums mirror prisma/schema.prisma ────────────────────────────────────────

export const QuestionTypeEnum = z.enum([
  'MCQ_SINGLE',
  'MCQ_MULTI',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'LONG_ANSWER',
  'FILL_BLANK',
  'DROPDOWN',
  'LINEAR_SCALE',
  'CHECKBOX_GRID',
  'RADIO_GRID',
  'DATE',
  'FILE_UPLOAD',
]);

const ExamStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'ACTIVE', 'COMPLETED', 'ARCHIVED']);

// ── Question ──────────────────────────────────────────────────────────────────

/**
 * A single question inside the exam-creation payload.
 * Validates options and metadata structure based on the specific QuestionType.
 */
export const questionSchema = z
  .object({
    type: QuestionTypeEnum,
    questionText: z.string().min(1, 'Question text is required'),
    options: z.unknown().optional(),
    correctAnswer: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    marks: z.number().int().positive('Marks must be a positive integer'),
  })
  .superRefine((q, ctx) => {
    // 1. correctAnswer: required for all types except FILE_UPLOAD
    if (q.type !== 'FILE_UPLOAD' && (!q.correctAnswer || q.correctAnswer.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correctAnswer'],
        message: `Correct answer is required for ${q.type} questions`,
      });
    }

    // 2. MCQ_SINGLE / MCQ_MULTI: options must be an array with at least 2 options
    if (q.type === 'MCQ_SINGLE' || q.type === 'MCQ_MULTI') {
      const isArr = Array.isArray(q.options);
      if (!isArr || (q.options as unknown[]).length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: `${q.type} questions require at least 2 options`,
        });
      }
    }

    // 3. TRUE_FALSE: options must be an array with exactly 2 options
    if (q.type === 'TRUE_FALSE') {
      const isArr = Array.isArray(q.options);
      if (!isArr || (q.options as unknown[]).length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: 'TRUE_FALSE questions must have exactly 2 options',
        });
      }
    }

    // 4. DROPDOWN: options must be an array with at least 1 option
    if (q.type === 'DROPDOWN') {
      const isArr = Array.isArray(q.options);
      if (!isArr || (q.options as unknown[]).length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: 'DROPDOWN questions require at least 1 option',
        });
      }
    }

    // 5. CHECKBOX_GRID / RADIO_GRID: options must have grid structure (rows & columns arrays)
    if (q.type === 'CHECKBOX_GRID' || q.type === 'RADIO_GRID') {
      const opts = q.options as { rows?: unknown[]; columns?: unknown[] } | undefined;
      const validGrid =
        opts &&
        typeof opts === 'object' &&
        Array.isArray(opts.rows) &&
        opts.rows.length >= 1 &&
        Array.isArray(opts.columns) &&
        opts.columns.length >= 1;

      if (!validGrid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: `${q.type} questions require a grid structure with rows and columns arrays in options`,
        });
      }
    }

    // 6. LINEAR_SCALE: requires metadata with min, max numbers where max > min
    if (q.type === 'LINEAR_SCALE') {
      const meta = q.metadata;
      const min = typeof meta?.min === 'number' ? meta.min : undefined;
      const max = typeof meta?.max === 'number' ? meta.max : undefined;

      if (min === undefined || max === undefined || max <= min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['metadata'],
          message: 'LINEAR_SCALE questions require metadata with numeric min and max where max > min',
        });
      }
    }
  });

// ── Create Exam ───────────────────────────────────────────────────────────────

export const createExamSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  durationMinutes: z
    .number()
    .int()
    .positive('Duration must be a positive integer'),
  totalMarks: z
    .number()
    .int()
    .positive('Total marks must be a positive integer'),
  status: ExamStatusEnum.optional().default('DRAFT'),
  questions: z
    .array(questionSchema)
    .min(1, 'Exam must have at least one question'),
});

// ── Submit Exam ───────────────────────────────────────────────────────────────

export const submissionItemSchema = z.object({
  questionId: z.string().min(1, 'questionId is required'),
  answerText: z.string().min(1, 'answerText must not be empty'),
});

export const submitExamSchema = z.object({
  sessionToken: z.string().uuid('sessionToken must be a valid UUID'),
  answers: z
    .array(submissionItemSchema)
    .min(1, 'At least one answer is required'),
});

// ── AI Question Generation ────────────────────────────────────────────────────

export const aiGenerateSchema = z.object({
  topic: z.string().min(2, 'Topic must be at least 2 characters'),
  count: z
    .number()
    .int()
    .min(1, 'Count must be at least 1')
    .max(20, 'Count must be at most 20')
    .optional(),
  difficulty: z
    .enum(['easy', 'medium', 'hard', 'Easy', 'Medium', 'Hard'])
    .optional(),
  type: QuestionTypeEnum.optional(),
});

// ── Proctoring Event Logging ──────────────────────────────────────────────────

export const proctoringEventSchema = z.object({
  sessionToken: z.string().uuid('sessionToken must be a valid UUID'),
  eventType: z.enum([
    'TAB_SWITCH',
    'APP_SWITCH',
    'MINIMIZE',
    'MOBILE_BUTTON',
    'AI_OVERLAY',
    'DEVTOOLS',
    'SCREEN_CAPTURE',
    'KEYBOARD_SHORTCUT',
  ]),
  reason: z.string().max(200, 'Reason must be at most 200 characters').optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type SubmitExamInput = z.infer<typeof submitExamSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type SubmissionItemInput = z.infer<typeof submissionItemSchema>;
export type AiGenerateInput = z.infer<typeof aiGenerateSchema>;
export type ProctoringEventInput = z.infer<typeof proctoringEventSchema>;
