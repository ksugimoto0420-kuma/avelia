import { env } from "@/lib/env";
import { sendMailTemplate } from "@/lib/mail";
import { VerifyEmailMail } from "@/lib/mail/templates/VerifyEmailMail";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "./tokens";

/** トークン有効期限 (24時間)。 */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * 対象ユーザーに新しい確認トークンを発行し、確認メールを送信する。
 * 既に有効な未使用トークンがある場合でも、直近のものを新しく作り直して送る。
 * (再送信APIから呼ばれるので毎回新規発行が期待される。)
 */
export async function issueEmailVerificationAndSend(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerified: true },
  });
  if (!user) return;
  // 既に確認済みなら送らない (悪意ある再送信を防ぐ)
  if (user.emailVerified) return;

  const { token, tokenHash } = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.emailVerificationToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const verifyUrl = `${env.appUrl}/auth/verify?token=${token}`;
  await sendMailTemplate({
    to: user.email,
    subject: "【Avelia FunClub】メールアドレスの確認のお願い",
    template: <VerifyEmailMail verifyUrl={verifyUrl} name={user.name} />,
  });
}

/**
 * トークン検証。成功すればユーザーの emailVerified を現在時刻でセットし、
 * 使用済みトークンとして usedAt をつける。既に検証済みでも冪等に true を返す。
 */
export async function verifyEmailToken(
  token: string,
): Promise<{ ok: true; alreadyVerified: boolean } | { ok: false; reason: string }> {
  if (!token) return { ok: false, reason: "トークンが指定されていません" };
  const tokenHash = hashToken(token);

  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, emailVerified: true } } },
  });
  if (!record) return { ok: false, reason: "無効なトークンです" };
  if (record.usedAt) {
    return { ok: false, reason: "このトークンは既に使用済みです" };
  }
  if (record.expiresAt < new Date()) {
    return { ok: false, reason: "トークンの有効期限が切れています" };
  }

  const alreadyVerified = Boolean(record.user.emailVerified);
  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.user.id },
      data: { emailVerified: alreadyVerified ? record.user.emailVerified : new Date() },
    }),
  ]);

  return { ok: true, alreadyVerified };
}
