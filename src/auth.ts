import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    // 一般ユーザー認証
    Credentials({
      id: "user-credentials",
      name: "User",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user) return null;
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          kind: "user" as const,
          role: null,
        };
      },
    }),
    // 管理者認証
    Credentials({
      id: "admin-credentials",
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const admin = await prisma.adminUser.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!admin || !admin.isActive) return null;
        const ok = await verifyPassword(password, admin.passwordHash);
        if (!ok) return null;

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          kind: "admin" as const,
          role: admin.role,
        };
      },
    }),
  ],
});
