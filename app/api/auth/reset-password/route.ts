import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/prisma/client";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
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

    const validation = resetPasswordSchema.safeParse(body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map((e) => e.message).join(", ");
      return NextResponse.json(
        { status: "error", message: errorMsg },
        { status: 400 }
      );
    }

    const { token, password } = validation.data;

    const user = await prisma.teacher.findUnique({ where: { reset_token: token } });
    if (!user || !user.reset_token_expires || user.reset_token_expires.getTime() < Date.now()) {
      return NextResponse.json(
        {
          status: "error",
          message: "This reset link is invalid or has expired. Please request a new one.",
        },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.teacher.update({
      where: { id: user.id },
      data: {
        password_hash: hashedPassword,
        reset_token: null,
        reset_token_expires: null,
      },
    });

    return NextResponse.json({
      status: "success",
      message: "Password updated successfully. You can now sign in.",
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Failed to reset password. Please try again.",
      },
      { status: 500 }
    );
  }
}
