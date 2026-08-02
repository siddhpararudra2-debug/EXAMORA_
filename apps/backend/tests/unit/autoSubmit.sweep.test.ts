import { SubmissionStatus } from '@prisma/client';

jest.mock('../../../../prisma/client.js', () => ({
  __esModule: true,
  default: {
    examSession: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('../../../../packages/database/src/grading.service', () => ({
  gradeSubmission: jest.fn(),
}));

import { autoSubmitExpiredSessions } from '../../../../server/jobs/autoSubmit.sweep';
import prisma from '../../../../prisma/client.js';
import { gradeSubmission } from '../../../../packages/database/src/grading.service';

const txMock = prisma;

describe('autoSubmit.sweep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('transitions expired IN_PROGRESS sessions and grades each one', async () => {
    (txMock.examSession.findMany as jest.Mock).mockResolvedValue([
      { id: 'sess_1', exam_id: 'exam_1' },
      { id: 'sess_2', exam_id: 'exam_1' },
    ]);
    (txMock.examSession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (gradeSubmission as jest.Mock).mockResolvedValue({ sessionId: 'sess_1' });

    const count = await autoSubmitExpiredSessions();

    expect(count).toBe(2);
    expect(txMock.examSession.findMany).toHaveBeenCalledWith({
      where: {
        status: SubmissionStatus.IN_PROGRESS,
        exam: { end_time: { lt: expect.any(Date) } },
      },
      select: { id: true, exam_id: true },
    });
    expect(txMock.examSession.updateMany).toHaveBeenCalledTimes(2);
    expect(txMock.examSession.updateMany).toHaveBeenCalledWith({
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
    (txMock.examSession.findMany as jest.Mock).mockResolvedValue([
      { id: 'sess_1', exam_id: 'exam_1' },
    ]);
    (txMock.examSession.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    const count = await autoSubmitExpiredSessions();

    expect(count).toBe(0);
    expect(gradeSubmission).not.toHaveBeenCalled();
  });
});
