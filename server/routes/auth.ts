import { Router } from "express";
import {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.js";
import { authRateLimiter, validateBody } from "../middleware/security.js";
import { requireTeacher } from "../middleware/auth.js";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.js";

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user with rate limiting and Zod input validation.
 */
router.post("/register", authRateLimiter, validateBody(registerSchema), register);

/**
 * POST /api/auth/login
 * User login with rate limiting and Zod input validation.
 */
router.post("/login", authRateLimiter, validateBody(loginSchema), login);

/**
 * POST /api/auth/forgot-password
 * Request a password reset link (sent by email if the account exists).
 * Rate limited to prevent email enumeration and abuse.
 */
router.post(
  "/forgot-password",
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  forgotPassword,
);

/**
 * POST /api/auth/reset-password
 * Set a new password using a valid, unexpired reset token.
 */
router.post(
  "/reset-password",
  authRateLimiter,
  validateBody(resetPasswordSchema),
  resetPassword,
);

/**
 * GET /api/auth/me
 * Get current authenticated user profile.
 */
router.get("/me", requireTeacher, getMe);

export default router;