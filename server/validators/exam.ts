import { z } from 'zod';

// ── Enums mirror prisma/schema.prisma ────────────────────────────────────────

const QuestionTypeEnum = z.enum(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER']);

const ExamStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'COMPLETED']);

// ── Question ──────────────────────────────────────────────────────────────────

/**
 * A single question inside the exam-creation payload.
 * `options` is only required for MCQ / TRUE_FALSE; it is an array of strings.
 */
export const questionSchema = z
  .object({
    type: QuestionTypeEnum,
    questionText: z.string().min(1, 'Question text is required'),
    options: z
      .array(z.string().min(1, 'Option text must not be empty'))
      .optional(),
    correctAnswer: z.string().min(1, 'Correct answer is required'),
    marks: z.number().int().positive('Marks must be a positive integer'),
  })
  .superRefine((q, ctx) => {
    // MCQ and TRUE_FALSE must include options
    if (q.type === 'MCQ' && (!q.options || q.options.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'MCQ questions require at least 2 options',
      });
    }
    if (q.type === 'TRUE_FALSE' && (!q.options || q.options.length !== 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'TRUE_FALSE questions must have exactly 2 options',
      });
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
  type: z
    .enum(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER'])
    .optional(),
});

// ── Proctoring Event Logging ──────────────────────────────────────────────────

export const proctoringEventSchema = z.object({
  sessionToken: z.string().uuid('sessionToken must be a valid UUID'),
  eventType: z.enum([
    'TAB_SWITCH',
    'FACE_LOST',
    'FULLSCREEN_EXIT',
    'MULTIPLE_FACES',
    'PHONE_DETECTED',
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
