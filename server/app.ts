import express, { Application, Request, Response } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import studentRoutes from './routes/student.js';
import examRoutes from './routes/exam.routes.js';
import { registerProctoringHandlers } from '../apps/backend/src/socket/proctoring.handler.js';
import { securityMiddleware, apiRateLimiter } from './middleware/security.js';
import { requestLogger } from './middleware/logger.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

export interface CreateAppOptions {
  /** Attach Socket.io (default true). Set false for API-only tests. */
  withSocket?: boolean;
  /** Override the CORS origin (defaults to FRONTEND_URL env). */
  frontendUrl?: string;
}

export interface AppBundle {
  app: Application;
  httpServer: HttpServer;
  io: Server | null;
}

/**
 * Creates a fully-configured Express app (middleware, routes, error handling).
 * `server.ts` uses it for the production listener; tests use it with
 * `withSocket: false` so they can exercise the API through Supertest
 * without binding a real port.
 */
export function createApp(options: CreateAppOptions = {}): AppBundle {
  const { withSocket = true, frontendUrl } = options;
  const allowedOrigin = frontendUrl ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';

  const app: Application = express();
  const httpServer = createServer(app);

  // Socket.io initialization (optional — skipped for API-only tests)
  let io: Server | null = null;
  if (withSocket) {
    io = new Server(httpServer, {
      cors: {
        origin: allowedOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });
  }

  // ── Security & parsing middleware ────────────────────────────────────────
  app.use(cors({
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token'],
  }));

  // Helmet with strict CSP allowing webcam media-src 'self' blob: & AI models
  app.use(securityMiddleware);

  // Request logging (method, URL, status, response time)
  app.use(requestLogger);

  // General API rate limiter (stricter limiters applied per-route)
  app.use('/api', apiRateLimiter);

  // JSON body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── API routes ───────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/exams', examRoutes);
  app.use('/api', studentRoutes);

  // 404 + global error handler (must be registered last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Register real-time proctoring handlers
  if (io) {
    registerProctoringHandlers(io);
  }

  // Store io instance for use in routes (kept for backward compatibility)
  (app as unknown as { io: Server | null }).io = io;

  return { app, httpServer, io };
}
