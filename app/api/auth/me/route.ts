import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/prisma/client";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-not-for-production";

export async function GET(req: NextRequest) {
  try {
    let token: string | undefined;

    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      token = req.cookies.get("auth_token")?.value;
    }

    if (!token) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized: No token provided" },
        { status: 401 }
      );
    }

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { status: "error", message: "Unauthorized: Invalid or expired token" },
        { status: 401 }
      );
    }

    const userId = payload?.userId || payload?.id;
    if (!userId) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized: Invalid payload" },
        { status: 401 }
      );
    }

    const user = await prisma.teacher.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, created_at: true },
    });

    if (!user) {
      return NextResponse.json(
        { status: "error", message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "success",
      data: { user },
      user,
    });
  } catch (error: any) {
    console.error("Auth me error:", error);
    return NextResponse.json(
      { status: "error", message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
