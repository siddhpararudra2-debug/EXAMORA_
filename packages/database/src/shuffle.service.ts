import { QuestionType } from '@prisma/client';

/**
 * E15 — deterministic per-student shuffling of questions and MCQ options.
 *
 * Every session gets a `shuffle_seed` (stored on ExamSession). The same seed
 * always produces the same order, so a student who refreshes the page sees
 * the exact same layout, while each student's paper differs.
 *
 * Answers are keyed by question id, and grading compares option TEXT against
 * the stored correct answer text, so shuffling options never breaks grading.
 */

export interface ExamSettingsShape {
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  /** Number of integrity warnings allowed before the session is terminated. */
  warningThreshold?: number;
  supervision?: {
    camera?: boolean;
    mic?: boolean;
  };
}

/** Defaults used when the exam has no settings row yet. */
export const DEFAULT_EXAM_SETTINGS: ExamSettingsShape = {
  shuffleQuestions: false,
  shuffleOptions: false,
  warningThreshold: 3,
  supervision: { camera: false, mic: false },
};

export function normalizeExamSettings(settings: unknown): ExamSettingsShape {
  const raw = (settings ?? {}) as Record<string, unknown>;
  const supervisionRaw = (raw.supervision ?? {}) as Record<string, unknown>;
  return {
    shuffleQuestions:
      typeof raw.shuffleQuestions === 'boolean'
        ? raw.shuffleQuestions
        : DEFAULT_EXAM_SETTINGS.shuffleQuestions,
    shuffleOptions:
      typeof raw.shuffleOptions === 'boolean'
        ? raw.shuffleOptions
        : DEFAULT_EXAM_SETTINGS.shuffleOptions,
    warningThreshold:
      typeof raw.warningThreshold === 'number' &&
      Number.isInteger(raw.warningThreshold) &&
      raw.warningThreshold >= 1 &&
      raw.warningThreshold <= 10
        ? raw.warningThreshold
        : DEFAULT_EXAM_SETTINGS.warningThreshold,
    supervision: {
      camera:
        typeof supervisionRaw.camera === 'boolean'
          ? supervisionRaw.camera
          : DEFAULT_EXAM_SETTINGS.supervision?.camera,
      mic:
        typeof supervisionRaw.mic === 'boolean'
          ? supervisionRaw.mic
          : DEFAULT_EXAM_SETTINGS.supervision?.mic,
    },
  };
}

/** Small, fast, seedable PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle driven by a seeded PRNG. Returns a new array. */
export function shuffleArray<T>(input: readonly T[], seed: number): T[] {
  const output = input.slice();
  const random = mulberry32(seed);
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

export interface ShufflableQuestion {
  id: string;
  type: QuestionType | string;
  options?: unknown;
}

const OPTION_SHUFFLE_EXEMPT_TYPES: ReadonlySet<string> = new Set([
  QuestionType.TRUE_FALSE,
]);

function isOptionsArray(options: unknown): options is string[] {
  return Array.isArray(options);
}

/**
 * Applies the exam's shuffle settings to a student's question paper.
 * Questions are re-ordered when `shuffleQuestions` is on; MCQ option arrays
 * are re-ordered when `shuffleOptions` is on (TRUE_FALSE is left alone so the
 * True/False pairing stays readable).
 *
 * @param seed Per-session seed — reuse the value already stored on the session.
 */
export function shuffleQuestionsForStudent<T extends ShufflableQuestion>(
  questions: readonly T[],
  settings: ExamSettingsShape,
  seed: number,
): T[] {
  const ordered = settings.shuffleQuestions
    ? shuffleArray(questions, seed)
    : questions.slice();

  if (!settings.shuffleOptions) {
    return ordered;
  }

  return ordered.map((question, index) => {
    if (OPTION_SHUFFLE_EXEMPT_TYPES.has(question.type)) {
      return question;
    }
    if (!isOptionsArray(question.options)) {
      return question;
    }
    // Derive a per-question seed so option orders vary between questions but
    // stay stable for a given session + question.
    const optionSeed = seed * 2654435761 + index * 40503 + 97;
    return { ...question, options: shuffleArray(question.options, optionSeed) };
  });
}

export function newShuffleSeed(): number {
  return 1 + Math.floor(Math.random() * 2147483646);
}
