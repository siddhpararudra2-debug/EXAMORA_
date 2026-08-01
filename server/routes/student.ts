import { Router } from "express";
import { joinExam } from "../controllers/student.js";
import { studentJoinRateLimiter, validateBody } from "../middleware/security.js";
import { studentJoinSchema } from "../validators/student.js";

const router = Router();

/**
 * POST /api/exams/:examId/join
 * Join an exam session with strict rate limiting (10 req/min/IP) and Zod validation.
 */
router.post(
  "/exams/:examId/join",
  studentJoinRateLimiter,
  validateBody(studentJoinSchema),
  joinExam
);

export default router;