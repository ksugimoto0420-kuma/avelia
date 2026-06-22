"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

const GENDERS = ["MALE", "FEMALE", "OTHER", "UNDISCLOSED"] as const;
type GenderValue = (typeof GENDERS)[number];

function parseGender(v: FormDataEntryValue | null): GenderValue | null {
  if (typeof v !== "string" || v === "") return null;
  return (GENDERS as readonly string[]).includes(v) ? (v as GenderValue) : null;
}

/**
 * `<input type="date">` の値 (YYYY-MM-DD) を Date に。空文字なら null。
 * 日本時間として解釈し、その日の 00:00 JST を保存する。
 */
function parseJoinedAt(v: FormDataEntryValue | null): Date | null {
  if (typeof v !== "string" || !v) return null;
  // YYYY-MM-DD → そのまま Date 化（UTC 00:00 になる）。微妙な日付ズレを避けるため
  // JST の 00:00 とみなして +0900 を付ける。
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
}

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
    gender: parseGender(formData.get("gender")),
    joinedAt: parseJoinedAt(formData.get("joinedAt")),
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
