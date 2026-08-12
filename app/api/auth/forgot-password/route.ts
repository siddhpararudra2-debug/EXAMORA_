import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { sendPasswordResetEmail } from "../../../../apps/backend/src/services/email.service";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { status: "error", message: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const validation = forgotPasswordSchema.safeParse(body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map((e) => e.message).join(", ");
      return NextResponse.json(
        { status: "error", message: errorMsg },
        { status: 400 }
      );
    }

    const email = validation.data.email.trim().toLowerCase();

    // Always respond success regardless of whether the account exists to
    // avoid leaking which emails are registered.
    const user = await prisma.teacher.findFirst({ where: { email } });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.teacher.update({
        where: { id: user.id },
        data: { reset_token: token, reset_token_expires: expiresAt },
      });

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const resetLink = `${frontendUrl}/forgot-password/reset?token=${encodeURIComponent(token)}`;

      await sendPasswordResetEmail({
        to: user.email,
        teacherName: user.name,
        resetLink,
      });
    }

    return NextResponse.json({
      status: "success",
      message: "If an account exists for that email, a reset link has been sent.",
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Failed to send reset link. Please try again.",
      },
      { status: 500 }
    );
  }
}
