import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@/prisma/client";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-not-for-production";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { status: "error", message: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map((e) => e.message).join(", ");
      return NextResponse.json(
        { status: "error", message: errorMsg },
        { status: 400 }
      );
    }

    const { email: rawEmail, password } = validation.data;
    const email = rawEmail.trim().toLowerCase();

    // Find teacher
    const user = await prisma.teacher.findUnique({
      where: { email },
    });

    if (!user || !user.password_hash) {
      return NextResponse.json(
        { status: "error", message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { status: "error", message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    const response = NextResponse.json(
      {
        status: "success",
        message: "Signed in successfully",
        data: { user: safeUser, token },
        user: safeUser,
        token,
      },
      { status: 200 }
    );

    // Set auth cookie
    response.cookies.set("auth_token", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Failed to sign in. Please try again.",
      },
      { status: 500 }
    );
  }
}
