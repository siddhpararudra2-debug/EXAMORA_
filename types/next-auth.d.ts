import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "TEACHER";
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: "TEACHER";
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: "TEACHER";
  }
}
