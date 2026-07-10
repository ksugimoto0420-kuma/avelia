import { AppError, handleError, ok } from "@/lib/api";
import { issueEmailVerificationAndSend } from "@/lib/auth/email-verification";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = registerSchema.parse(body);
    const normalized = email.toLowerCase();

    const exists = await prisma.user.findUnique({
      where: { email: normalized },
    });
    if (exists) {
      throw new AppError("このメールアドレスは既に登録されています", 409);
    }

    const user = await prisma.user.create({
      data: {
        email: normalized,
        passwordHash: await hashPassword(password),
        name: name ?? null,
      },
      select: { id: true, email: true, name: true },
    });

    // #34: メール確認トークンを発行してメール送信 (失敗しても登録は成功扱い)
    await issueEmailVerificationAndSend(user.id);

    return ok(user, 201);
  } catch (err) {
    return handleError(err);
  }
}
