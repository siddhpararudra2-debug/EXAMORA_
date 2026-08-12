import { Prisma, SubmissionStatus, ViolationType } from '@prisma/client';

import prisma from '../../prisma/client.js';
import { gradeSubmission } from '../../packages/database/src/grading.service.js';

export const AUTO_SUBMIT_SWEEP_INTERVAL_MS = 60_000;

/**
 * Advisory lock key (PostgreSQL) for the auto-submit sweep. When several
 * server instances share one database, only the instance that acquires the
 * lock runs each sweep pass; the others skip it. This prevents the race
 * where every instance would close the same sessions simultaneously.
 */
export const SWEEP_ADVISORY_LOCK_KEY = 7273821;

/**
 * Sessions whose last lockdown heartbeat is older than this are considered
 * stale (client JS disabled/crashed, network lost, or the student left).
 */
export const HEARTBEAT_STALE_MS = Number(process.env.HEARTBEAT_STALE_MS ?? 90_000);

/**
 * A session with a stale heartbeat is terminated after this many consecutive
 * stale sweep passes (each pass is AUTO_SUBMIT_SWEEP_INTERVAL_MS), giving a
 * short grace period for network blips before server-side termination.
 */
export const HEARTBEAT_TERMINATE_AFTER_STALE_SWEEPS = Number(
  process.env.HEARTBEAT_TERMINATE_AFTER_STALE_SWEEPS ?? 2,
);

export interface SweepOutcome {
  /** Expired sessions transitioned to AUTO_SUBMITTED by this run. */
  transitioned: { id: string; exam_id: string }[];
  /** Newly flagged stale-heartbeat sessions (first stale pass, evidence logged). */
  staleFlagged: number;
  /** Stale-heartbeat sessions terminated this run (consecutive stale passes exceeded). */
  staleTerminated: { id: string; exam_id: string }[];
}

const sweepOnce = async (tx: Prisma.TransactionClient, now: Date): Promise<SweepOutcome> => {
  const outcome: SweepOutcome = { transitioned: [], staleFlagged: 0, staleTerminated: [] };

  // ── 1. Auto-submit expired sessions ─────────────────────────────────────
  const expired = await tx.examSession.findMany({
    where: {
      status: SubmissionStatus.IN_PROGRESS,
      exam: { end_time: { lt: now } },
    },
    select: { id: true, exam_id: true },
  });

  for (const session of expired) {
    // Atomic guard: only succeeds when the session is still IN_PROGRESS, so
    // concurrent sweeps / direct submits can never double-transition it.
    const closed = await tx.examSession.updateMany({
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

    outcome.transitioned.push(session);
  }

  // ── 2. Stale-heartbeat enforcement (server-side proctoring evidence) ────
  // If the client-side lockdown dies (JS disabled, listeners removed, VM
  // isolation), the heartbeat stops and the sweep records it — the client
  // cannot erase server-inserted violations. After N consecutive stale
  // passes the session is terminated, independently of the client.
  const staleCutoff = new Date(now.getTime() - HEARTBEAT_STALE_MS);
  const staleSessions = await tx.examSession.findMany({
    where: {
      status: SubmissionStatus.IN_PROGRESS,
      OR: [
        { last_heartbeat_at: { lt: staleCutoff } },
        { last_heartbeat_at: null, started_at: { lt: staleCutoff } },
      ],
    },
    select: { id: true, exam_id: true, last_heartbeat_at: true },
  });

  for (const session of staleSessions) {
    const heartbeatViolations = await tx.violation.count({
      where: { session_id: session.id, type: ViolationType.HEARTBEAT_TIMEOUT },
    });

    if (heartbeatViolations < HEARTBEAT_TERMINATE_AFTER_STALE_SWEEPS - 1) {
      // First stale pass: record server-side evidence, keep the session alive.
      await tx.violation.create({
        data: {
          session_id: session.id,
          type: ViolationType.HEARTBEAT_TIMEOUT,
          description:
            'Lockdown heartbeat went silent (client JS disabled, crashed, or network lost)',
          metadata: {
            last_heartbeat_at: session.last_heartbeat_at?.toISOString() ?? null,
            stale_threshold_ms: HEARTBEAT_STALE_MS,
          },
        },
      });
      outcome.staleFlagged += 1;
      continue;
    }

    const terminated = await tx.examSession.updateMany({
      where: { id: session.id, status: SubmissionStatus.IN_PROGRESS },
      data: { status: SubmissionStatus.TERMINATED, submitted_at: now },
    });

    if (terminated.count > 0) {
      outcome.staleTerminated.push(session);
    }
  }

  return outcome;
};

/**
 * Runs one full sweep pass inside a single transaction guarded by a
 * PostgreSQL advisory lock, then grades every newly-closed session.
 *
 * Returns the total number of sessions closed by this sweep run
 * (auto-submitted + stale-terminated). 0 when another instance held the lock.
 */
export const autoSubmitExpiredSessions = async (): Promise<number> => {
  const now = new Date();

  const outcome = await prisma.$transaction(async (tx) => {
    const lockRows = await tx.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(${SWEEP_ADVISORY_LOCK_KEY}) AS locked
    `;
    const locked = Boolean(lockRows[0]?.locked);

    if (!locked) {
      return null; // another instance is already sweeping this pass
    }

    return sweepOnce(tx, now);
  });

  if (!outcome) {
    console.log(
      `Auto-submit sweep: another instance holds the sweep lock — skipping this pass (${now.toISOString()})`,
    );
    return 0;
  }

  // Grade outside the lock/transaction — LLM/number-crunching must not hold
  // the advisory lock hostage while other instances wait their turn.
  for (const closed of outcome.transitioned) {
    try {
      await gradeSubmission(closed.exam_id, closed.id);
    } catch (error) {
      console.error(
        `Auto-submit: grading failed for session ${closed.id} (exam ${closed.exam_id}):`,
        error,
      );
    }
  }

  const closedTotal = outcome.transitioned.length + outcome.staleTerminated.length;
  if (closedTotal > 0 || outcome.staleFlagged > 0) {
    console.log(
      `Auto-submit sweep: closed ${closedTotal} session(s) ` +
        `(auto-submitted ${outcome.transitioned.length}, stale-heartbeat terminated ${outcome.staleTerminated.length}); ` +
        `flagged ${outcome.staleFlagged} stale session(s) at ${now.toISOString()}`,
    );
  }

  return closedTotal;
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