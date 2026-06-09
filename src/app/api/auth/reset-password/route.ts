import { createHash } from "node:crypto";
import { AppError, handleError, ok } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, password } = resetPasswordSchema.parse(body);
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError("トークンが無効または期限切れです", 400);
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return ok({ message: "パスワードを再設定しました" });
  } catch (err) {
    return handleError(err);
  }
}
