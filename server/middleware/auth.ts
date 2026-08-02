import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

/**
 * Shape of the decoded JWT payload for teachers.
 */
export interface TeacherPayload {
  userId: string;
  email: string;
}

/**
 * Extend Express's Request so downstream controllers get a typed `teacher` property.
 */
export interface AuthenticatedRequest extends Request {
  teacher: TeacherPayload;
}

/**
 * requireTeacher
 *
 * Guards any route that requires a valid teacher JWT.
 * Expects: `Authorization: Bearer <token>` header.
 *
 * On success  → attaches `req.teacher` and calls next().
 * On failure  → returns 401 with a clear JSON error message.
 */
export const requireTeacher = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 'error',
      message: 'Authentication required. Provide a Bearer token.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as TeacherPayload;

    // Attach to request for use in controllers
    (req as AuthenticatedRequest).teacher = {
      userId: payload.userId,
      email: payload.email,
    };

    next();
  } catch (err) {
    const message =
      err instanceof jwt.TokenExpiredError
        ? 'Token has expired. Please log in again.'
        : 'Invalid token.';

    res.status(401).json({ status: 'error', message });
  }
};
