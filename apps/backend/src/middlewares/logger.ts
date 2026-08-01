import { Request, Response, NextFunction } from 'express';

/**
 * Request logging middleware.
 * Logs HTTP method, URL, status code, and response time for every request.
 * Health checks are logged at debug level (suppressed) to avoid noise.
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const start = process.hrtime.bigint();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const { statusCode } = res;

    if (originalUrl === '/health') return;

    const logLine = `[HTTP] ${method} ${originalUrl} → ${statusCode} (${durationMs.toFixed(1)}ms)`;

    if (statusCode >= 500) {
      console.error(logLine);
    } else if (statusCode >= 400) {
      console.warn(logLine);
    } else {
      console.log(logLine);
    }
  });

  next();
};
