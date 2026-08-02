import { SubmissionStatus } from '@prisma/client';

import prisma from '../../prisma/client.js';
import { gradeSubmission } from '../../packages/database/src/grading.service.js';

export const AUTO_SUBMIT_SWEEP_INTERVAL_MS = 60_000;

/**
 * Auto-submits every IN_PROGRESS exam session whose exam's end_time has
 * passed. Each expired session is atomically transitioned to AUTO_SUBMITTED
 * (race-safe updateMany guard, mirroring submitSession) and then graded like
 * a normal submission so results show up for the teacher.
 *
 * Returns the number of sessions closed by this sweep run.
 */
export const autoSubmitExpiredSessions = async (): Promise<number> => {
  const now = new Date();

  const expired = await prisma.examSession.findMany({
    where: {
      status: SubmissionStatus.IN_PROGRESS,
      exam: { end_time: { lt: now } },
    },
    select: { id: true, exam_id: true },
  });

  let transitioned = 0;
  for (const session of expired) {
    const closed = await prisma.examSession.updateMany({
      where: {
        id: session.id,
        status: SubmissionStatus.IN_PROGRESS,
      },
      data: {
        status: SubmissionStatus.AUTO_SUBMITTED,
        submitted_at: now,
      },
    });

    if (closed.count === 0) {
      continue; // already closed by another sweep run / concurrent submit
    }

    try {
      await gradeSubmission(session.exam_id, session.id);
    } catch (error) {
      console.error(
        `Auto-submit: grading failed for session ${session.id} (exam ${session.exam_id}):`,
        error,
      );
    }

    transitioned += 1;
  }

  if (transitioned > 0) {
    console.log(
      `Auto-submit sweep: closed ${transitioned} expired session(s) at ${now.toISOString()}`,
    );
  }

  return transitioned;
};

/**
 * Starts the periodic auto-submit sweep. Returns the interval handle so the
 * caller can clearInterval() during graceful shutdown.
 */
export const startAutoSubmitSweep = (
  intervalMs: number = AUTO_SUBMIT_SWEEP_INTERVAL_MS,
): NodeJS.Timeout => {
  const interval = setInterval(() => {
    autoSubmitExpiredSessions().catch((error) => {
      console.error('Auto-submit sweep failed:', error);
    });
  }, intervalMs);

  // Don't keep the process alive solely because of the sweep timer.
  interval.unref?.();

  return interval;
};
