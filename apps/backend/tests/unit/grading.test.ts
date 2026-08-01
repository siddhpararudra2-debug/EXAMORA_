import { QuestionType, SubmissionStatus } from '@prisma/client';

jest.mock('../../../../prisma/client.js', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn(txMock),
    ),
    examSession: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    answer: {
      findMany: jest.fn(),
    },
    question: {
      findMany: jest.fn(),
    },
  },
}));

import { gradeSubmission, gradeAllSubmissionsForExam } from '../../../../packages/database/src/grading.service';
import prisma from '../../../../prisma/client.js';

// The mock transaction client is the same object as the mocked prisma
const txMock = prisma;

describe('grading.service', () => {
  const sessionId = 'sess_1';
  const examId = 'exam_1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('gradeSubmission', () => {
    it('grades an MCQ submission and persists score + percentage', async () => {
      (txMock.examSession.findFirst as jest.Mock).mockResolvedValue({ id: sessionId });
      (txMock.answer.findMany as jest.Mock).mockResolvedValue([
        { question_id: 'q1', answer_text: 'Paris' },
        { question_id: 'q2', answer_text: 'wrong-answer' },
      ]);
      (txMock.question.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'q1',
          type: QuestionType.MCQ_SINGLE,
          correct_answer: 'Paris',
          marks: 2,
          negative_marks: 0,
        },
        {
          id: 'q2',
          type: QuestionType.MCQ_SINGLE,
          correct_answer: 'Mars',
          marks: 2,
          negative_marks: 0,
        },
      ]);
      (txMock.examSession.update as jest.Mock).mockResolvedValue({ id: sessionId });

      const result = await gradeSubmission(examId, sessionId);

      expect(result).toEqual({
        sessionId,
        score: 2,
        totalMarks: 4,
        correctAnswers: 1,
        totalQuestions: 2,
      });
      expect(txMock.examSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { total_score: 2, percentage: 50 },
      });
    });

    it('is case-insensitive for MCQ/TRUE_FALSE answers', async () => {
      (txMock.examSession.findFirst as jest.Mock).mockResolvedValue({ id: sessionId });
      (txMock.answer.findMany as jest.Mock).mockResolvedValue([
        { question_id: 'q1', answer_text: '  paris ' },
      ]);
      (txMock.question.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'q1',
          type: QuestionType.MCQ_SINGLE,
          correct_answer: 'Paris',
          marks: 2,
          negative_marks: 0,
        },
      ]);
      (txMock.examSession.update as jest.Mock).mockResolvedValue({ id: sessionId });

      const result = await gradeSubmission(examId, sessionId);

      expect(result.correctAnswers).toBe(1);
      expect(result.score).toBe(2);
    });

    it('requires exact match for SHORT_ANSWER', async () => {
      (txMock.examSession.findFirst as jest.Mock).mockResolvedValue({ id: sessionId });
      (txMock.answer.findMany as jest.Mock).mockResolvedValue([
        { question_id: 'q1', answer_text: 'a similar sentence' },
      ]);
      (txMock.question.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'q1',
          type: QuestionType.SHORT_ANSWER,
          correct_answer: 'The exact model answer',
          marks: 5,
          negative_marks: 0,
        },
      ]);
      (txMock.examSession.update as jest.Mock).mockResolvedValue({ id: sessionId });

      const result = await gradeSubmission(examId, sessionId);

      expect(result.score).toBe(0);
      expect(result.correctAnswers).toBe(0);
    });

    it('throws when the session does not exist', async () => {
      (txMock.examSession.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(gradeSubmission(examId, sessionId)).rejects.toThrow(
        `Session ${sessionId} not found for exam ${examId}`,
      );
    });
  });

  describe('gradeAllSubmissionsForExam', () => {
    it('grades every SUBMITTED/AUTO_SUBMITTED session of the exam', async () => {
      (prisma.examSession.findMany as jest.Mock).mockResolvedValue([
        { id: 'sess_1' },
        { id: 'sess_2' },
      ]);

      (txMock.examSession.findFirst as jest.Mock).mockResolvedValue({ id: 'sess' });
      (txMock.answer.findMany as jest.Mock).mockResolvedValue([]);
      (txMock.question.findMany as jest.Mock).mockResolvedValue([]);
      (txMock.examSession.update as jest.Mock).mockResolvedValue({ id: 'sess' });

      const results = await gradeAllSubmissionsForExam(examId);

      expect(prisma.examSession.findMany).toHaveBeenCalledWith({
        where: {
          exam_id: examId,
          status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.AUTO_SUBMITTED] },
        },
        select: { id: true },
      });
      expect(results).toHaveLength(2);
    });
  });
});
