import { Request, Response, NextFunction } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { BankQuestionInput } from '../validators/bank.js';

const prisma = new PrismaClient();

/**
 * GET /api/v1/question-bank
 * Protected — teacher JWT. Lists the teacher's saved questions, newest first.
 */
export const listBankQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;

    const questions = await prisma.bankQuestion.findMany({
      where: { teacher_id: teacher.userId },
      orderBy: { created_at: 'desc' },
    });

    res.json({ status: 'success', data: { questions } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/question-bank
 * Protected — teacher JWT. Saves one question to the teacher's bank.
 */
export const saveBankQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const body = req.body as BankQuestionInput;

    const question = await prisma.bankQuestion.create({
      data: {
        teacher_id: teacher.userId,
        type: body.type,
        question_text: body.questionText,
        options: body.options
          ? (body.options as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        correct_answer: body.correctAnswer ?? null,
        explanation: body.explanation ?? null,
        marks: body.marks,
        metadata: body.metadata
          ? (body.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    res.status(201).json({ status: 'success', data: { question } });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/question-bank/:id
 * Protected — teacher JWT (owner only).
 */
export const deleteBankQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { id } = req.params;

    const existing = await prisma.bankQuestion.findFirst({
      where: { id, teacher_id: teacher.userId },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({
        status: 'error',
        message: 'Question not found in your bank',
      });
      return;
    }

    await prisma.bankQuestion.delete({ where: { id } });

    res.json({
      status: 'success',
      data: { message: 'Question removed from your bank' },
    });
  } catch (err) {
    next(err);
  }
};
