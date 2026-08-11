import { Request, Response, NextFunction } from "express";
import { PrismaClient, SubmissionStatus } from "@prisma/client";
import { Readable } from "stream";
import csvParser from "csv-parser";
import { AuthenticatedRequest } from "../../../../server/middleware/auth.js";
import { sendExamInviteEmail } from "../services/email.service.js";

const prisma = new PrismaClient();

export interface CSVStudentRow {
  Name?: string;
  name?: string;
  Email?: string;
  email?: string;
  EnrollmentNo?: string;
  enrollmentNo?: string;
  [key: string]: string | undefined;
}

/**
 * TASK 2: POST /api/exams/:examId/invite-bulk
 * Accepts CSV file upload via multer.
 * Parses CSV rows, generates unique session token, creates StudentSession in DB,
 * and emails personalized join link to candidates.
 */
export const inviteBulkStudents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { teacher } = req as AuthenticatedRequest;
    const { examId } = req.params;

    // Verify teacher owns the exam
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        title: true,
        created_by: true,
        duration_minutes: true,
        end_time: true,
      },
    });

    if (!exam) {
      res.status(404).json({ status: "error", message: "Exam not found" });
      return;
    }

    if (exam.created_by !== teacher.userId) {
      res.status(403).json({ status: "error", message: "Access denied" });
      return;
    }

    // Check if CSV file or JSON payload was provided
    let rawRows: CSVStudentRow[] = [];

    if (req.file) {
      // Parse file buffer via csv-parser stream
      const bufferStream = new Readable();
      bufferStream.push(req.file.buffer);
      bufferStream.push(null);

      rawRows = await new Promise((resolve, reject) => {
        const results: CSVStudentRow[] = [];
        bufferStream
          .pipe(csvParser())
          .on("data", (data) => results.push(data))
          .on("end", () => resolve(results))
          .on("error", (err) => reject(err));
      });
    } else if (req.body.students) {
      try {
        rawRows = typeof req.body.students === "string"
          ? JSON.parse(req.body.students)
          : req.body.students;
      } catch (err) {
        res.status(400).json({ status: "error", message: "Invalid students JSON payload format" });
        return;
      }
    } else {
      res.status(400).json({ status: "error", message: "CSV file upload (file) or JSON body (students) is required" });
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const [idx, row] of rawRows.entries()) {
      const studentName = (row.Name || row.name || "").trim();
      const studentEmail = (row.Email || row.email || "").trim();
      const enrollmentNo = (row.EnrollmentNo || row.enrollmentNo || `ENR${Date.now()}${idx}`).trim();

      if (!studentEmail) {
        failed++;
        errors.push(`Row ${idx + 1}: Missing email address`);
        continue;
      }

      try {
        const sessionToken = crypto.randomUUID();

        // Create or update ExamSession record
        const session = await prisma.examSession.upsert({
          where: { session_token: sessionToken },
          update: {},
          create: {
            exam_id: examId,
            student_name: studentName || "Student",
            student_email: studentEmail,
            enrollment_number: enrollmentNo,
            session_token: sessionToken,
            status: SubmissionStatus.IN_PROGRESS,
            expires_at:
              exam.end_time ??
              new Date(Date.now() + exam.duration_minutes * 60 * 1000),
          },
        });

        const joinLink = `${frontendUrl}/exam/${examId}/take?token=${session.session_token}`;

        // Send email
        await sendExamInviteEmail({
          to: studentEmail,
          studentName: studentName || "Student",
          examTitle: exam.title,
          joinLink,
        });

        successful++;
      } catch (err: any) {
        failed++;
        errors.push(`Row ${idx + 1} (${studentEmail}): ${err.message || "Failed to process"}`);
      }
    }

    res.json({
      status: "success",
      data: {
        total: rawRows.length,
        successful,
        failed,
        errors,
      },
    });
  } catch (err) {
    next(err);
  }
};
