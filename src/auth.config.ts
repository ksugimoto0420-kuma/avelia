import type { AdminRole } from "@prisma/client";
import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

// Edge セーフな設定（prisma / bcrypt を含めない）。
// providers の authorize 実装は auth.ts 側（Node ランタイム）で注入する。
// セッション有効期間（30日）。アクティブな操作があるたびにスライド延長される。
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export const authConfig = {
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: 60 * 60 * 24, // 1日ごとに署名トークンをローテーション
  },
  jwt: {
    maxAge: SESSION_MAX_AGE,
  },
  pages: { signIn: "/auth/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        // @ts-expect-error custom fields set in authorize()
        token.kind = user.kind;
        // @ts-expect-error custom fields set in authorize()
        token.role = (user.role ?? null) as AdminRole | null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.kind = token.kind;
        session.user.role = token.role ?? null;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { nextUrl } = request;
      const path = nextUrl.pathname;
      const user = auth?.user;

      // 管理画面：/admin/login 以外は管理者必須。TALENT は /talent に追放
      if (path.startsWith("/admin")) {
        if (path === "/admin/login") return true;
        if (user?.kind === "admin") {
          if (user.role === "TALENT") {
            return NextResponse.redirect(new URL("/talent", nextUrl));
          }
          return true;
        }
        return NextResponse.redirect(new URL("/admin/login", nextUrl));
      }

      // タレント画面：/talent/login 以外は admin セッション必須
      if (path.startsWith("/talent")) {
        if (path === "/talent/login") return true;
        if (user?.kind === "admin") return true;
        return NextResponse.redirect(new URL("/talent/login", nextUrl));
      }

      // ユーザー専用ページ：要ログイン
      if (path.startsWith("/mypage") || path.startsWith("/checkout")) {
        if (user?.kind === "user") return true;
        const loginUrl = new URL("/auth/login", nextUrl);
        loginUrl.searchParams.set("callbackUrl", path);
        return NextResponse.redirect(loginUrl);
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
