"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().trim().max(100).optional().or(z.literal("")),
  nameKana: z.string().trim().max(100).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9\-+\s]*$/, "電話番号は数字・ハイフンのみで入力してください")
    .optional()
    .or(z.literal("")),
  postalCode: z
    .string()
    .trim()
    .max(10)
    .regex(/^[0-9\-]*$/, "郵便番号は数字・ハイフンのみで入力してください")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
});

export async function updateProfile(formData: FormData): Promise<void> {
  const sessionUser = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name") ?? "",
    nameKana: formData.get("nameKana") ?? "",
    phone: formData.get("phone") ?? "",
    postalCode: formData.get("postalCode") ?? "",
    address: formData.get("address") ?? "",
  });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "入力内容を確認してください",
    );
  }

  await prisma.user.update({
    where: { id: sessionUser.id },
    data: {
      name: parsed.data.name || null,
      nameKana: parsed.data.nameKana || null,
      phone: parsed.data.phone || null,
      postalCode: parsed.data.postalCode || null,
      address: parsed.data.address || null,
    },
  });

  revalidatePath("/mypage/profile");
  redirect("/mypage/profile?saved=1");
}

export async function changePassword(formData: FormData): Promise<void> {
  const sessionUser = await requireUser();
  const current = (formData.get("currentPassword") as string) ?? "";
  const next = (formData.get("newPassword") as string) ?? "";
  const confirm = (formData.get("confirmPassword") as string) ?? "";

  if (!current || !next || !confirm) {
    throw new Error("すべての項目を入力してください");
  }
  if (next.length < 8) {
    throw new Error("新しいパスワードは8文字以上で設定してください");
  }
  if (next !== confirm) {
    throw new Error("新しいパスワードと確認入力が一致しません");
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { passwordHash: true },
  });
  if (!user) throw new Error("ユーザーが見つかりません");

  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) throw new Error("現在のパスワードが正しくありません");

  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { passwordHash: await hashPassword(next) },
  });

  revalidatePath("/mypage/profile");
  redirect("/mypage/profile?passwordChanged=1");
}
