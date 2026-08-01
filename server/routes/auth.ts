import { Router } from "express";
import { register, login } from "../controllers/auth.js";
import { authRateLimiter, validateBody } from "../middleware/security.js";
import { registerSchema, loginSchema } from "../validators/auth.js";

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

export default router;