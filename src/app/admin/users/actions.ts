"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

export async function updateUserProfile(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("ユーザーIDが指定されていません");

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error("ユーザーが見つかりません");
  if (existing.email.endsWith("@deleted.local")) {
    throw new Error("退会済ユーザーは編集できません");
  }

  const data = {
    name: ((formData.get("name") as string | null) ?? "").trim() || null,
    nameKana:
      ((formData.get("nameKana") as string | null) ?? "").trim() || null,
    phone: ((formData.get("phone") as string | null) ?? "").trim() || null,
    postalCode:
      ((formData.get("postalCode") as string | null) ?? "").trim() || null,
    address: ((formData.get("address") as string | null) ?? "").trim() || null,
  };

  await prisma.user.update({ where: { id }, data });
  await logOperation({
    adminUserId: admin.id,
    action: "user.update",
    targetType: "User",
    targetId: id,
  });

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
  redirect(`/admin/users/${id}`);
}

/**
 * アカウント無効化（ソフトデリート）。
 * メールを deleted_<timestamp>_<id>@deleted.local にマスキングしてログイン不可にし、
 * 個人情報フィールドをクリアする。注文履歴・抽選応募・デジタル付与等のリレーションは
 * 売上・配信責任の追跡に必要なため残す。
 */
export async function deactivateUser(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("ユーザーIDが指定されていません");

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error("ユーザーが見つかりません");
  if (existing.email.endsWith("@deleted.local")) {
    throw new Error("既に退会処理済みです");
  }

  const stamp = Date.now();
  const maskedEmail = `deleted_${stamp}_${id.slice(0, 8)}@deleted.local`;

  await prisma.user.update({
    where: { id },
    data: {
      email: maskedEmail,
      passwordHash: "DEACTIVATED",
      name: null,
      nameKana: null,
      phone: null,
      postalCode: null,
      address: null,
      emailVerified: null,
    },
  });

  await logOperation({
    adminUserId: admin.id,
    action: "user.deactivate",
    targetType: "User",
    targetId: id,
    detail: { originalEmail: existing.email },
  });

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
  redirect(`/admin/users/${id}`);
}
