import { Request, Response, NextFunction } from 'express';
import { PrismaClient, ExamStatus, SubmissionStatus } from '@prisma/client';
import { studentJoinSchema, StudentJoinInput } from '../validators/student.js';

const prisma = new PrismaClient();

// Helper to validate with Zod
const validate = <T>(schema: any, data: unknown): { success: boolean; data?: T; error?: string } => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((e: { message: string }) => e.message).join(', ');
    return { success: false, error: errors };
  }
  return { success: true, data: result.data as T };
};

export const joinExam = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { examId } = req.params;

    const validation = validate<StudentJoinInput>(studentJoinSchema, req.body);
    if (!validation.success) {
      res.status(400).json({ status: 'error', message: validation.error });
      return;
    }

    const { studentName, studentEmail, enrollmentNo } = validation.data!;

    // Check if exam exists
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      res.status(404).json({ status: 'error', message: 'Exam not found' });
      return;
    }

    // Check if exam is available (only ACTIVE exams are joinable)
    if (exam.status !== ExamStatus.ACTIVE) {
      res.status(400).json({
        status: 'error',
        message: 'Exam is not active yet — it has not been published',
      });
      return;
    }

    // Check if student already has an active session for this exam
    const existingSession = await prisma.examSession.findFirst({
      where: {
        exam_id: examId,
        student_email: studentEmail,
        enrollment_number: enrollmentNo,
        status: SubmissionStatus.IN_PROGRESS,
      },
    });

    if (existingSession) {
      // Return existing session token
      res.json({
        status: 'success',
        data: {
          sessionToken: existingSession.session_token,
          studentName: existingSession.student_name,
          studentEmail: existingSession.student_email,
          enrollmentNo: existingSession.enrollment_number,
        },
      });
      return;
    }

    // Generate cryptographically secure random session token
    const sessionToken = crypto.randomUUID();

    // Create student session
    const studentSession = await prisma.examSession.create({
      data: {
        exam_id: examId,
        student_name: studentName,
        student_email: studentEmail,
        enrollment_number: enrollmentNo,
        session_token: sessionToken,
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        sessionToken: studentSession.session_token,
        studentName: studentSession.student_name,
        studentEmail: studentSession.student_email,
        enrollmentNo: studentSession.enrollment_number,
      },
    });
  } catch (error) {
    next(error);
  }
};
