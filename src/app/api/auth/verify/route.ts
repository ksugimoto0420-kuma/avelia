import { AppError, handleError, ok } from "@/lib/api";
import { verifyEmailToken } from "@/lib/auth/email-verification";

export const runtime = "nodejs";

/**
 * メール確認トークンの検証。
 * POST /api/auth/verify { token: string }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { token?: unknown };
    const token = typeof body.token === "string" ? body.token : "";
    if (!token) throw new AppError("token が指定されていません", 400);
    const result = await verifyEmailToken(token);
    if (!result.ok) throw new AppError(result.reason, 400);
    return ok({ alreadyVerified: result.alreadyVerified });
  } catch (err) {
    return handleError(err);
  }
}
