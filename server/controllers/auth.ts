import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { registerSchema, loginSchema, RegisterInput, LoginInput } from '../validators/auth.js';

const prisma = new PrismaClient();

// Helper to validate with Zod
const validate = <T>(schema: any, data: unknown): { success: boolean; data?: T; error?: string } => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => e.message).join(', ');
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

    const { name, email, password } = validation.data!;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ status: 'error', message: 'Email already registered' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user (teacher)
    const user = await prisma.user.create({
      data: { name, email, passwordHash: hashedPassword },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      status: 'success',
      data: { user, token },
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

    const { email, password } = validation.data!;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    res.json({
      status: 'success',
      data: {
        user: { id: user.id, name: user.name, email: user.email },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};