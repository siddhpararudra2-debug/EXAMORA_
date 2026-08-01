import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Augmented error shape — allows controllers/middleware to set a status code.
 */
export interface HttpError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

/**
 * Maps known Prisma errors to clean HTTP responses.
 * P2002  → unique constraint violation (409)
 * P2025  → record not found (404)
 * P2003  → foreign key constraint violation (400)
 * P2014  → relation violation (400)
 */
function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  message: string;
} {
  switch (err.code) {
    case 'P2002':
      return {
        statusCode: 409,
        message: 'A record with this value already exists.',
      };
    case 'P2025':
      return { statusCode: 404, message: 'Record not found.' };
    case 'P2003':
    case 'P2014':
      return {
        statusCode: 400,
        message: 'Referenced record does not exist or is invalid.',
      };
    default:
      return { statusCode: 500, message: 'Internal server error' };
  }
}

/**
 * Global error handler — last middleware in the chain.
 * - Logs full stack traces in development, minimal details in production.
 * - Returns clean JSON error responses (never leaks internals in production).
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  let statusCode = 500;
  let status = 'error';
  let message = 'Internal server error';

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(err);
    statusCode = mapped.statusCode;
    message = mapped.message;
  } else {
    const httpErr = err as HttpError;
    if (httpErr.statusCode) statusCode = httpErr.statusCode;
    if (httpErr.status) status = httpErr.status;
    if (httpErr.message && httpErr.isOperational !== false) {
      message = httpErr.message;
    }
  }

  if (statusCode >= 500) {
    console.error('❌ Error:', {
      message: err.message,
      ...(isDevelopment && { stack: err.stack }),
      statusCode,
    });
  } else {
    console.warn('⚠️ Request error:', { message, statusCode });
  }

  res.status(statusCode).json({
    status,
    message,
    ...(isDevelopment && { stack: err.stack }),
  });
};

/**
 * 404 handler — clean JSON for unmatched routes.
 */
export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
  });
};

/**
 * Wraps async route handlers so thrown/rejected promises are forwarded
 * to the global error handler (belt & braces alongside try/catch).
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
