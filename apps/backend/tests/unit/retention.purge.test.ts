jest.mock('../../../../prisma/client.js', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    $queryRaw: jest.fn(),
    violation: {
      updateMany: jest.fn(),
    },
  },
}));

import { purgeViolationMetadata, RETENTION_DAYS } from '../../../../server/jobs/retention.purge';
import prisma from '../../../../prisma/client.js';

// The mock transaction client is the same object as the mocked prisma
const txMock = prisma;

describe('retention.purge', () => {
  const now = new Date('2026-09-27T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('nulls metadata on violations of long-completed exams', async () => {
    (txMock.$queryRaw as jest.Mock).mockResolvedValue([{ locked: true }]);
    (txMock.violation.updateMany as jest.Mock).mockResolvedValue({ count: 7 });

    const outcome = await purgeViolationMetadata(now);

    expect(outcome).toEqual({ purged: 7 });
    const args = (txMock.violation.updateMany as jest.Mock).mock.calls[0][0];
    expect(args.data).toEqual({ metadata: null });
    expect(args.where.session.exam.status).toBe('COMPLETED');
    // Cutoff is exactly RETENTION_DAYS before `now`.
    const cutoff = args.where.occurred_at.lt as Date;
    const days = (now.getTime() - cutoff.getTime()) / 86400000;
    expect(days).toBe(RETENTION_DAYS);
  });

  it('skips the pass when another instance holds the lock', async () => {
    (txMock.$queryRaw as jest.Mock).mockResolvedValue([{ locked: false }]);

    const outcome = await purgeViolationMetadata(now);

    expect(outcome).toEqual({ purged: 0 });
    expect(txMock.violation.updateMany).not.toHaveBeenCalled();
  });
});
