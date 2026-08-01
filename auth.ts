import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";

import prisma from "@/prisma/client";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const teacher = await prisma.teacher.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!teacher || !teacher.password_hash) return null;

        const isPasswordValid = await bcrypt.compare(password, teacher.password_hash);
        if (!isPasswordValid) return null;

        return {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          role: "TEACHER",
        };
      },
    }),
    // Optional Google OAuth — active only when GOOGLE_CLIENT_ID/SECRET are set.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
    async signIn({ user, account }) {
      // Google sign-in: create or link a Teacher record by email.
      if (account?.provider === "google" && user.email) {
        const existing = await prisma.teacher.findUnique({
          where: { email: user.email.toLowerCase() },
        });
        if (!existing) {
          await prisma.teacher.create({
            data: {
              email: user.email.toLowerCase(),
              name: user.name ?? "Teacher",
              google_id: account.providerAccountId,
            },
          });
        } else if (!existing.google_id) {
          await prisma.teacher.update({
            where: { id: existing.id },
            data: { google_id: account.providerAccountId },
          });
        }
      }
      return true;
    },
  },
});
