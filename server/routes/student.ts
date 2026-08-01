import { Router } from 'express';
import { joinExam } from '../controllers/student.js';

const router = Router();

router.post('/exams/:examId/join', joinExam);

export default router;