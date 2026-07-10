import { AppError, handleError, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { sendMailTemplate } from "@/lib/mail";
import { DebugMail } from "@/lib/mail/templates/DebugMail";

export const runtime = "nodejs";

/**
 * メール送信基盤の動作確認用 (Issue #32)。
 * POST /api/admin/mail-debug { to: string, message?: string }
 * OPERATOR 以上でログインしていることが必要。
 * 本番リリース前に別 Issue で削除予定。
 */
export async function POST(req: Request) {
  try {
    await requireAdmin("OPERATOR");
    const body = (await req.json().catch(() => ({}))) as {
      to?: unknown;
      message?: unknown;
    };
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const message =
      typeof body.message === "string" ? body.message.trim() : undefined;
    if (!to) throw new AppError("to は必須です", 400);

    await sendMailTemplate({
      to,
      subject: "[Avelia] メール送信基盤の動作確認",
      template: <DebugMail recipient={to} message={message} />,
    });

    return ok({ sentTo: to });
  } catch (err) {
    return handleError(err);
  }
}
