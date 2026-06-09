import { createHash, randomBytes } from "node:crypto";
import { handleError, ok } from "@/lib/api";
import { sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { requestResetSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = requestResetSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // ユーザー有無を漏らさないよう常に成功レスポンスを返す
    if (user) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間

      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      const url = `${env.appUrl}/auth/reset-password?token=${token}`;
      await sendMail({
        to: user.email,
        subject: "【Avelia FunClub】パスワード再設定のご案内",
        text: `以下のリンクから1時間以内にパスワードを再設定してください。\n${url}`,
      });
    }

    return ok({ message: "再設定メールを送信しました（登録がある場合）" });
  } catch (err) {
    return handleError(err);
  }
}
