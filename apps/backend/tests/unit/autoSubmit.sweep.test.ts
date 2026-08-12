import { SubmissionStatus, ViolationType } from '@prisma/client';

jest.mock('../../../../prisma/client.js', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../../packages/database/src/grading.service', () => ({
  gradeSubmission: jest.fn(),
}));

import { autoSubmitExpiredSessions } from '../../../../server/jobs/autoSubmit.sweep';
import prisma from '../../../../prisma/client.js';
import { gradeSubmission } from '../../../../packages/database/src/grading.service';

interface FakeTx {
  $queryRaw: jest.Mock;
  examSession: {
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
  violation: {
    count: jest.Mock;
    create: jest.Mock;
  };
}

const makeTx = (): FakeTx => ({
  $queryRaw: jest.fn().mockResolvedValue([{ locked: true }]),
  examSession: {
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  violation: {
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({}),
  },
});

const runSweep = async (tx: FakeTx): Promise<number> => {
  (prisma.$transaction as jest.Mock).mockImplementation(
    (cb: (tx: FakeTx) => Promise<unknown>) => cb(tx),
  );
  return autoSubmitExpiredSessions();
};

describe('autoSubmit.sweep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips the pass entirely when another instance holds the advisory lock', async () => {
    const tx = makeTx();
    tx.$queryRaw.mockResolvedValue([{ locked: false }]);

    const count = await runSweep(tx);

    expect(count).toBe(0);
    expect(tx.examSession.findMany).not.toHaveBeenCalled();
  });

  it('transitions expired IN_PROGRESS sessions inside the lock and grades each one', async () => {
    const tx = makeTx();
    tx.examSession.findMany.mockResolvedValueOnce([
      { id: 'sess_1', exam_id: 'exam_1' },
      { id: 'sess_2', exam_id: 'exam_1' },
    ]);
    tx.examSession.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    (gradeSubmission as jest.Mock).mockResolvedValue({ sessionId: 'sess_1' });

    const count = await runSweep(tx);

    expect(count).toBe(2);
    expect(tx.examSession.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'sess_1', status: SubmissionStatus.IN_PROGRESS },
      data: {
        status: SubmissionStatus.AUTO_SUBMITTED,
        submitted_at: expect.any(Date),
      },
    });
    expect(gradeSubmission).toHaveBeenCalledWith('exam_1', 'sess_1');
    expect(gradeSubmission).toHaveBeenCalledWith('exam_1', 'sess_2');
  });

  it('skips sessions already closed by a concurrent sweep (no double grading)', async () => {
    const tx = makeTx();
    tx.examSession.findMany.mockResolvedValueOnce([
      { id: 'sess_1', exam_id: 'exam_1' },
    ]);
    tx.examSession.updateMany.mockResolvedValue({ count: 0 });

    const count = await runSweep(tx);

    expect(count).toBe(0);
    expect(gradeSubmission).not.toHaveBeenCalled();
  });

  it('flags stale heartbeats once, then terminates on the next consecutive pass', async () => {
    const tx = makeTx();
    const staleSession = {
      id: 'sess_1',
      exam_id: 'exam_1',
      last_heartbeat_at: new Date(Date.now() - 5 * 60_000),
    };

    // Pass 1: first stale detection, no prior HEARTBEAT_TIMEOUT violation.
    tx.examSession.findMany
      .mockResolvedValueOnce([]) // expired sessions query
      .mockResolvedValueOnce([staleSession]); // stale-heartbeat query
    tx.violation.count.mockResolvedValueOnce(0);
    tx.examSession.updateMany.mockResolvedValue({ count: 0 });

    let count = await runSweep(tx);
    expect(count).toBe(0);
    expect(tx.violation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          session_id: 'sess_1',
          type: ViolationType.HEARTBEAT_TIMEOUT,
        }),
      }),
    );

    // Pass 2: violation already exists → terminate instead of flagging again.
    jest.clearAllMocks();
    tx.examSession.findMany
      .mockResolvedValueOnce([]) // expired sessions query
      .mockResolvedValueOnce([staleSession]); // stale-heartbeat query
    tx.violation.count.mockResolvedValueOnce(1);
    tx.examSession.updateMany.mockResolvedValue({ count: 1 });

    count = await runSweep(tx);
    expect(count).toBe(1);
    expect(tx.examSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'sess_1', status: SubmissionStatus.IN_PROGRESS },
      data: {
        status: SubmissionStatus.TERMINATED,
        submitted_at: expect.any(Date),
      },
    });
    expect(tx.violation.create).not.toHaveBeenCalled();
  });
});