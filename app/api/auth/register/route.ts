import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@/prisma/client";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
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

    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map((e) => e.message).join(", ");
      return NextResponse.json(
        { status: "error", message: errorMsg },
        { status: 400 }
      );
    }

    const { name, email: rawEmail, password } = validation.data;
    const email = rawEmail.trim().toLowerCase();

    // Check if teacher already exists
    const existingUser = await prisma.teacher.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { status: "error", message: "Email already registered. Please sign in instead." },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create teacher record
    const user = await prisma.teacher.create({
      data: {
        name: name.trim(),
        email,
        password_hash: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true,
      },
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json(
      {
        status: "success",
        message: "Account created successfully",
        data: { user, token },
        user,
        token,
      },
      { status: 201 }
    );

    // Set auth cookie
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Failed to create account. Please try again.",
      },
      { status: 500 }
    );
  }
}
