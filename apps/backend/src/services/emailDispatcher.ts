import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { EmailLogStatus, SubmissionStatus } from '@prisma/client';
import prisma from '../../../../prisma/client.js';
import { createTransporter } from './email.service.js';
import {
  ClassAnalytics,
  ExamData,
  QuestionResultData,
  SessionData,
  generateMarksheet,
  sanitizeForFilename,
} from './marksheetGenerator.js';

const MAX_EMAIL_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1500, 6000];
const GRADED_SESSION_STATUSES = [SubmissionStatus.SUBMITTED, SubmissionStatus.AUTO_SUBMITTED];

export interface DispatchSummary {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export interface SendMarksheetEmailParams {
  to: string;
  studentName: string;
  examTitle: string;
  percentage: number | null;
  pdfBuffer: Buffer;
  filename: string;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const htmlForMarksheet = ({ studentName, examTitle, percentage }: Omit<SendMarksheetEmailParams, 'to' | 'pdfBuffer' | 'filename'>): string => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
    <h2 style="color: #4338ca; margin-bottom: 8px;">Your Examora Marksheet</h2>
    <p style="color: #334155; font-size: 15px;">Hello <strong>${studentName}</strong>,</p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      Your result for <strong>"${examTitle}"</strong> is ready${percentage !== null ? ` — you scored <strong>${percentage.toFixed(2)}%</strong>.` : '.'}
      The detailed, verified marksheet is attached to this email.
    </p>
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="color: #94a3b8; font-size: 11px; text-align: center;">
      EXAMORA - Verified Result • Free &amp; Open-Source AI Proctoring
    </p>
  </div>
`;

export async function sendMarksheetEmail({
  to,
  studentName,
  examTitle,
  percentage,
  pdfBuffer,
  filename,
}: SendMarksheetEmailParams): Promise<boolean> {
  try {
    const from = process.env.SMTP_FROM || '"Examora Platform" <noreply@examora.edu>';

    if (!process.env.SMTP_USER && process.env.NODE_ENV !== 'production') {
      console.log(`[Email Dispatcher Mock] Marksheet for ${to} (${filename}), size ${pdfBuffer.length} bytes`);
      return true;
    }

    const transporter = createTransporter();
    await transporter.sendMail({
      from,
      to,
      subject: `Your Examora Marksheet: ${examTitle}`,
      html: htmlForMarksheet({ studentName, examTitle, percentage }),
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
    return true;
  } catch (err) {
    console.error(`[Email Dispatcher] Failed to email marksheet to ${to}:`, err);
    return false;
  }
}

async function ensureEmailLog(params: {
  examId: string;
  sessionId: string;
  recipientEmail: string;
  pdfUrl: string;
  status: EmailLogStatus;
  sentAt?: Date;
}): Promise<void> {
  const { examId, sessionId, recipientEmail, pdfUrl, status, sentAt } = params;
  const existing = await prisma.emailLog.findFirst({
    where: { exam_id: examId, session_id: sessionId },
    select: { id: true },
  });
  if (existing) {
    await prisma.emailLog.update({
      where: { id: existing.id },
      data: { recipient_email: recipientEmail, pdf_url: pdfUrl, status, sent_at: sentAt ?? null },
    });
  } else {
    await prisma.emailLog.create({
      data: { exam_id: examId, session_id: sessionId, recipient_email: recipientEmail, pdf_url: pdfUrl, status, sent_at: sentAt },
    });
  }
}

export async function dispatchResults(examId: string): Promise<DispatchSummary> {
  const summary: DispatchSummary = { total: 0, sent: 0, failed: 0, skipped: 0, errors: [] };

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      creator: { select: { name: true, college_name: true } },
      questions: { select: { id: true, question_text: true, type: true, marks: true, negative_marks: true, order_index: true } },
      sessions: {
        where: { status: { in: GRADED_SESSION_STATUSES } },
        include: { answers: true },
        orderBy: { student_name: 'asc' },
      },
    },
  });

  if (!exam) {
    throw new Error(`Exam ${examId} not found`);
  }

  const totalMarks = exam.questions.reduce((sum, q) => sum + q.marks, 0);
  const examData: ExamData = {
    id: exam.id,
    title: exam.title,
    subject: null,
    collegeName: exam.creator?.college_name ?? null,
    teacherName: exam.creator?.name ?? null,
  };

  const percentages = exam.sessions
    .map((session) => (session.percentage ?? (totalMarks > 0 && session.total_score !== null ? (Number(session.total_score) / totalMarks) * 100 : null)))
    .filter((value): value is number => value !== null);

  const classAnalytics: ClassAnalytics = {
    max: percentages.length ? Math.max(...percentages) : null,
    min: percentages.length ? Math.min(...percentages) : null,
    average: percentages.length ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length : null,
    totalStudents: percentages.length,
    scores: percentages,
  };

  summary.total = exam.sessions.length;

  for (const session of exam.sessions) {
    if (!session.student_email) {
      summary.skipped += 1;
      console.warn(`[Email Dispatcher] Session ${session.id} skipped: no student email`);
      continue;
    }

    const answersByQuestion = new Map(session.answers.map((answer) => [answer.question_id, answer]));
    const questionResults: QuestionResultData[] = exam.questions.map((question) => {
      const answer = answersByQuestion.get(question.id);
      return {
        id: question.id,
        orderIndex: question.order_index,
        questionText: question.question_text,
        type: question.type,
        marks: question.marks,
        negativeMarks: Number(question.negative_marks) || 0,
        marksAwarded: answer?.marks_awarded !== null && answer?.marks_awarded !== undefined ? Number(answer.marks_awarded) : null,
        isCorrect: answer?.is_correct ?? null,
        answerText: answer?.answer_text ?? '',
      };
    });

    const sessionData: SessionData = {
      sessionId: session.id,
      sessionToken: session.session_token,
      studentName: session.student_name,
      enrollmentNumber: session.enrollment_number,
      studentEmail: session.student_email,
      status: session.status,
      submittedAt: session.submitted_at,
      totalScore: session.total_score !== null && session.total_score !== undefined ? Number(session.total_score) : null,
      totalMarks,
      percentage: session.percentage !== null && session.percentage !== undefined ? Number(session.percentage) : null,
      questionResults,
    };

    try {
      const pdfBuffer = await generateMarksheet(sessionData, examData, classAnalytics);

      const marksheetDir = path.join(os.tmpdir(), 'examora-marksheets', sanitizeForFilename(examId));
      await fs.mkdir(marksheetDir, { recursive: true });
      const pdfFilename = `Marksheet_${sanitizeForFilename(session.student_name)}_${sanitizeForFilename(session.session_token)}.pdf`;
      const pdfPath = path.join(marksheetDir, pdfFilename);
      await fs.writeFile(pdfPath, pdfBuffer);

      const attachmentFilename = `Marksheet_${sanitizeForFilename(session.student_name)}_${sanitizeForFilename(exam.title)}.pdf`;
      await ensureEmailLog({
        examId: exam.id,
        sessionId: session.id,
        recipientEmail: session.student_email,
        pdfUrl: pdfPath,
        status: EmailLogStatus.PENDING,
      });

      let delivered = false;
      for (let attempt = 1; attempt <= MAX_EMAIL_ATTEMPTS && !delivered; attempt += 1) {
        try {
          delivered = await sendMarksheetEmail({
            to: session.student_email,
            studentName: session.student_name,
            examTitle: exam.title,
            percentage: sessionData.percentage,
            pdfBuffer,
            filename: attachmentFilename,
          });
        } catch (err) {
          console.error(`[Email Dispatcher] Attempt ${attempt}/${MAX_EMAIL_ATTEMPTS} failed for ${session.student_email}:`, err);
        }

        if (!delivered && attempt < MAX_EMAIL_ATTEMPTS) {
          console.warn(`[Email Dispatcher] Retrying ${session.student_email} in ${RETRY_DELAYS_MS[attempt - 1]}ms`);
          await sleep(RETRY_DELAYS_MS[attempt - 1]);
        }
      }

      if (delivered) {
        await ensureEmailLog({
          examId: exam.id,
          sessionId: session.id,
          recipientEmail: session.student_email,
          pdfUrl: pdfPath,
          status: EmailLogStatus.SENT,
          sentAt: new Date(),
        });
        summary.sent += 1;
        console.log(`[Email Dispatcher] Marksheet sent to ${session.student_email}`);
      } else {
        await ensureEmailLog({
          examId: exam.id,
          sessionId: session.id,
          recipientEmail: session.student_email,
          pdfUrl: pdfPath,
          status: EmailLogStatus.FAILED,
        });
        summary.failed += 1;
        summary.errors.push(`Failed to deliver marksheet to ${session.student_email} after ${MAX_EMAIL_ATTEMPTS} attempts`);
        console.error(`[Email Dispatcher] Marksheet FAILED for ${session.student_email} after ${MAX_EMAIL_ATTEMPTS} attempts`);
      }
    } catch (err) {
      summary.failed += 1;
      summary.errors.push(`Error processing session ${session.id} (${session.student_email}): ${err instanceof Error ? err.message : String(err)}`);
      console.error(`[Email Dispatcher] Error processing session ${session.id}:`, err);
      try {
        await ensureEmailLog({
          examId: exam.id,
          sessionId: session.id,
          recipientEmail: session.student_email,
          pdfUrl: '',
          status: EmailLogStatus.FAILED,
        });
      } catch (logErr) {
        console.error(`[Email Dispatcher] Failed to persist failure for session ${session.id}:`, logErr);
      }
    }
  }

  return summary;
}
