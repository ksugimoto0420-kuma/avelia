"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth/guards";
import { sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(1, "お名前を入力してください").max(100),
  email: z.string().trim().email("メールアドレスの形式が正しくありません").max(200),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().min(5, "5文字以上で入力してください").max(5000),
});

export type ContactResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitContact(formData: FormData): Promise<ContactResult> {
  const parsed = schema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    subject: formData.get("subject") ?? "",
    message: formData.get("message") ?? "",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
    };
  }

  const session = await getOptionalUser();

  const created = await prisma.contactMessage.create({
    data: {
      userId: session?.id ?? null,
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject || null,
      message: parsed.data.message,
      status: "OPEN",
    },
  });

  await sendMail({
    to: parsed.data.email,
    subject: "【Avelia FunClub】お問い合わせを受け付けました",
    text: `${parsed.data.name} 様\n\nお問い合わせいただきありがとうございます。以下の内容で受け付けました。\n\n--- 受付内容 ---\n${parsed.data.subject ? `件名: ${parsed.data.subject}\n` : ""}${parsed.data.message}\n\n受付番号: ${created.id}\n\nご返信まで数営業日いただくことがございます。何卒よろしくお願いいたします。`,
  });

  redirect("/contact?sent=1");
}
