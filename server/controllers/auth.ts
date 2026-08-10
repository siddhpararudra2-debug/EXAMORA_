import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { registerSchema, loginSchema, RegisterInput, LoginInput } from '../validators/auth.js';
import { JWT_SECRET } from '../config.js';

const prisma = new PrismaClient();

// Helper to validate with Zod
const validate = <T>(schema: any, data: unknown): { success: boolean; data?: T; error?: string } => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((e: { message: string }) => e.message).join(', ');
    return { success: false, error: errors };
  }
  return { success: true, data: result.data as T };
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validation = validate<RegisterInput>(registerSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ status: 'error', message: validation.error });
      return;
    }

    const { name, email: rawEmail, password } = validation.data!;
    const email = rawEmail.trim().toLowerCase();

    // Check if teacher already exists
    const existingUser = await prisma.teacher.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ status: 'error', message: 'Email already registered' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create teacher
    const user = await prisma.teacher.create({
      data: { name: name.trim(), email, password_hash: hashedPassword },
      select: { id: true, name: true, email: true, created_at: true },
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      status: 'success',
      data: { user, token },
      user,
      token,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validation = validate<LoginInput>(loginSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ status: 'error', message: validation.error });
      return;
    }

    const { email: rawEmail, password } = validation.data!;
    const email = rawEmail.trim().toLowerCase();

    // Find teacher
    const user = await prisma.teacher.findUnique({ where: { email } });
    if (!user || !user.password_hash) {
      res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      status: 'success',
      data: {
        user: { id: user.id, name: user.name, email: user.email },
        token,
      },
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const teacherPayload = (req as any).teacher;
    if (!teacherPayload || !teacherPayload.userId) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }

    const user = await prisma.teacher.findUnique({
      where: { id: teacherPayload.userId },
      select: { id: true, name: true, email: true, created_at: true },
    });

    if (!user) {
      res.status(404).json({ status: 'error', message: 'User not found' });
      return;
    }

    res.json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};