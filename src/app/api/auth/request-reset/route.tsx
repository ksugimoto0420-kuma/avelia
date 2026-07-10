import { handleError, ok } from "@/lib/api";
import { generateToken } from "@/lib/auth/tokens";
import { env } from "@/lib/env";
import { sendMailTemplate } from "@/lib/mail";
import { PasswordResetMail } from "@/lib/mail/templates/PasswordResetMail";
import { prisma } from "@/lib/prisma";
import { requestResetSchema } from "@/lib/validators";

export const runtime = "nodejs";

/**
 * パスワード再設定リンクをメール送信する。
 * ユーザー有無を漏らさないよう、常に成功レスポンスを返す。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = requestResetSchema.parse(body);
    const normalized = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, email: true, name: true },
    });

    if (user) {
      const { token, tokenHash } = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 時間

      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      const resetUrl = `${env.appUrl}/auth/reset-password?token=${token}`;
      await sendMailTemplate({
        to: user.email,
        subject: "【Avelia FunClub】パスワード再設定のご案内",
        template: <PasswordResetMail resetUrl={resetUrl} name={user.name} />,
      });
    }

    return ok({ message: "再設定メールを送信しました（登録がある場合）" });
  } catch (err) {
    return handleError(err);
  }
}
