import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge ランタイムで動く軽量インスタンス（JWT のデコードと認可のみ）
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // 静的アセット・API・画像最適化を除外
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
