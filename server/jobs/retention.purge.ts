import prisma from '../../prisma/client.js';

/**
 * Final verification — 90-day violation-metadata retention purge (spec §6.4).
 *
 * Nulls `Violation.metadata` for exams completed more than RETENTION_DAYS ago
 * (per `Exam.completed_at`, set by declare-results). The row's `type` and
 * `occurred_at` are kept for aggregate warning counts and audit; student
 * identity fields and answers are NOT auto-purged (retained until the
 * educator deletes the exam).
 *
 * Same lifecycle pattern as server/jobs/autoSubmit.sweep.ts: a transaction-
 * scoped Postgres advisory lock makes daily passes safe across instances,
 * and the caller owns the interval handle (cleared on SIGTERM in server.ts).
 */

export const RETENTION_DAYS = 90;
export const RETENTION_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RETENTION_PURGE_LOCK_KEY = 7273822;

export interface RetentionPurgeOutcome {
  purged: number;
}

export async function purgeViolationMetadata(
  now: Date = new Date(),
): Promise<RetentionPurgeOutcome> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const lock = (await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(${RETENTION_PURGE_LOCK_KEY}) AS locked
    `);
    if (!lock[0]?.locked) {
      console.log(
        `Retention purge: another instance holds the purge lock — skipping this pass (${now.toISOString()})`,
      );
      return { purged: 0 };
    }

    const result = await tx.violation.updateMany({
      where: {
        metadata: { not: null },
        occurred_at: { lt: cutoff },
        session: {
          exam: {
            status: 'COMPLETED',
            completed_at: { lt: cutoff },
          },
        },
      },
      data: { metadata: null },
    });

    if (result.count > 0) {
      console.log(
        `Retention purge: nulled metadata on ${result.count} violation(s) older than ${RETENTION_DAYS} days (${now.toISOString()})`,
      );
    }
    return { purged: result.count };
  });
}

export const startRetentionPurge = (
  intervalMs: number = RETENTION_PURGE_INTERVAL_MS,
): NodeJS.Timeout => {
  const interval = setInterval(() => {
    purgeViolationMetadata().catch((error) => {
      console.error('Retention purge failed:', error);
    });
  }, intervalMs);
  // Don't keep the process alive solely because of the purge timer.
  interval.unref?.();
  return interval;
};
