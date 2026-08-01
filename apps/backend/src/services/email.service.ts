import nodemailer from "nodemailer";

export interface SendInviteEmailParams {
  to: string;
  studentName: string;
  examTitle: string;
  joinLink: string;
}

/**
 * Creates and returns a Nodemailer transporter configured for Gmail / Custom SMTP.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends a personalized exam invitation email with the unique student join link.
 */
export async function sendExamInviteEmail({
  to,
  studentName,
  examTitle,
  joinLink,
}: SendInviteEmailParams): Promise<boolean> {
  const from = process.env.SMTP_FROM || `"Examora Platform" <noreply@examora.edu>`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #4338ca; margin-bottom: 8px;">Online Exam Invitation — Examora</h2>
      <p style="color: #334155; font-size: 15px;">Hello <strong>${studentName}</strong>,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        You have been registered for <strong>"${examTitle}"</strong> on the Examora smart online exam platform.
      </p>

      <div style="margin: 24px 0; text-align: center;">
        <a href="${joinLink}" target="_blank" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; font-weight: bold; font-size: 15px; border-radius: 8px; text-decoration: none; display: inline-block;">
          Join Exam Session
        </a>
      </div>

      <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
        <strong>Proctoring Notice:</strong> This exam is monitored using automated browser lockdown and client-side AI proctoring. Please ensure your webcam is enabled and remain in fullscreen mode throughout the exam.
      </p>

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center;">
        Examora Platform • Free & Open-Source AI Proctoring
      </p>
    </div>
  `;

  try {
    const transporter = createTransporter();

    // In local development or if SMTP credentials are omitted, log link gracefully
    if (!process.env.SMTP_USER && process.env.NODE_ENV !== "production") {
      console.log(`[Email Service Mock] Invite link for ${to}: ${joinLink}`);
      return true;
    }

    await transporter.sendMail({
      from,
      to,
      subject: `Exam Invitation: ${examTitle}`,
      html: htmlContent,
    });

    return true;
  } catch (err) {
    console.error(`[Email Service] Failed to send email to ${to}:`, err);
    return false;
  }
}
