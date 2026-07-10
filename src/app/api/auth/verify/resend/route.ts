import { AppError, handleError, ok } from "@/lib/api";
import { issueEmailVerificationAndSend } from "@/lib/auth/email-verification";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * ログイン中ユーザーが自分宛にメール確認リンクを再送信する。
 * 既に emailVerified が入っているユーザーには送信しない (成功レスポンスは返す)。
 */
export async function POST() {
  try {
    const sessionUser = await requireUser();
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { emailVerified: true },
    });
    if (!user) throw new AppError("ユーザーが見つかりません", 404);

    if (!user.emailVerified) {
      await issueEmailVerificationAndSend(sessionUser.id);
    }
    return ok({ message: "確認メールを送信しました" });
  } catch (err) {
    return handleError(err);
  }
}
