import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/**
 * Step 1: Configure Helmet with strict Content Security Policy (CSP) headers.
 * Explicitly ALLOWS webcam ('self' blob:) and AI model loading via CDN or self.
 *
 * Security note: `script-src` deliberately omits 'unsafe-inline' and
 * 'unsafe-eval'. These API responses carry no inline scripts, and TensorFlow.js
 * is bundled by the Next.js frontend (served with its own strict CSP from
 * next.config.mjs), so neither is needed here. 'wasm-unsafe-eval' keeps the
 * WebAssembly backend of client-side models working if ever loaded from this
 * origin. Inline styles stay allowed (Next.js injects them) and are inert for
 * XSS when script-src is locked down.
 */
export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'wasm-unsafe-eval'", // WebAssembly for client-side model backends
        "https://cdn.jsdelivr.net",
        "https://*.tensorflow.org",
      ],
      connectSrc: [
        "'self'",
        "ws:",
        "wss:",
        "https://cdn.jsdelivr.net",
        "https://*.tensorflow.org",
        "https://storage.googleapis.com",
      ],
      mediaSrc: ["'self'", "blob:"], // EXPLICITLY ALLOW WEBCAM & MEDIA BLOBS
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"], // Clickjacking protection — the exam UI must never be iframed
      formAction: ["'self'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  referrerPolicy: { policy: "no-referrer" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * Step 2: Rate Limiter Configuration using express-rate-limit.
 */

// Strict rate limit for student join route (POST /api/exams/:id/join): 10 requests per 1 minute per IP
export const studentJoinRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per 1 minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many exam join attempts from this IP. Please try again after 1 minute.",
  },
});

// Standard limit for login and auth routes: 15 requests per 15 minutes per IP
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 login attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many login attempts from this IP. Please try again after 15 minutes.",
  },
});

// General API rate limiter for standard endpoints: 100 requests per 1 minute per IP
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests from this IP. Please slow down.",
  },
});

/**
 * Step 3: Express validation middleware using Zod.
 * Sanitizes and validates request payload to prevent injection and malformed input.
 */
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: "error",
          message: "Validation error",
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }
      return res.status(400).json({
        status: "error",
        message: "Invalid request payload format",
      });
    }
  };
};

export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: "error",
          message: "Invalid route parameter",
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }
      return res.status(400).json({ status: "error", message: "Invalid URL parameters" });
    }
  };
};
