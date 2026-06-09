import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/guards";

/** 業務エラー。API ハンドラから throw して統一レスポンスに変換する。 */
export class AppError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function ok<T>(data: T, init?: number | ResponseInit) {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json({ data }, responseInit);
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: { message, code } }, { status });
}

/** API ハンドラ内の例外を統一的にレスポンス化する。 */
export function handleError(err: unknown) {
  if (err instanceof AuthError) {
    return fail(err.message, err.status);
  }
  if (err instanceof AppError) {
    return fail(err.message, err.status, err.code);
  }
  if (err instanceof ZodError) {
    return fail(
      err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
      422,
      "VALIDATION",
    );
  }
  console.error("[API ERROR]", err);
  return fail("サーバーエラーが発生しました", 500);
}
