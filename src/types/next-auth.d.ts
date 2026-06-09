import type { AdminRole } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      kind: "user" | "admin";
      role?: AdminRole | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    kind: "user" | "admin";
    role?: AdminRole | null;
  }
}
