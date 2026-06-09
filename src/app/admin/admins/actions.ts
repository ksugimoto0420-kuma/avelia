"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AdminRole } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

const VALID_ROLES: AdminRole[] = ["OWNER", "MANAGER", "OPERATOR", "VIEWER"];

export async function createAdmin(formData: FormData) {
  const me = await requireAdmin("OWNER");

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const name = (formData.get("name") as string)?.trim();
  const password = (formData.get("password") as string) ?? "";
  const role = (formData.get("role") as AdminRole) ?? "VIEWER";

  if (!email || !name || !password) {
    throw new Error("メール・名前・パスワードは必須です");
  }
  if (!VALID_ROLES.includes(role)) {
    throw new Error("無効なロールです");
  }
  if (password.length < 8) {
    throw new Error("パスワードは8文字以上で設定してください");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("メールアドレスの形式が正しくありません");
  }

  const dup = await prisma.adminUser.findUnique({ where: { email } });
  if (dup) throw new Error("このメールアドレスは既に登録されています");

  const created = await prisma.adminUser.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
      role,
      isActive: true,
    },
  });

  await logOperation({
    adminUserId: me.id,
    action: "admin.create",
    targetType: "AdminUser",
    targetId: created.id,
    detail: { email, name, role },
  });

  revalidatePath("/admin/admins");
  redirect("/admin/admins");
}

export async function updateAdmin(formData: FormData) {
  const me = await requireAdmin("OWNER");
  const id = formData.get("id") as string;
  if (!id) throw new Error("管理者IDが指定されていません");

  const name = (formData.get("name") as string)?.trim();
  const role = (formData.get("role") as AdminRole) ?? "VIEWER";
  const isActive = formData.get("isActive") === "on";
  const password = (formData.get("password") as string) ?? "";

  if (!name) throw new Error("名前は必須です");
  if (!VALID_ROLES.includes(role)) throw new Error("無効なロールです");

  if (id === me.id && !isActive) {
    throw new Error("自分自身を無効化することはできません");
  }
  if (id === me.id && role !== "OWNER") {
    throw new Error("自分自身のロールを下げることはできません");
  }

  const data: {
    name: string;
    role: AdminRole;
    isActive: boolean;
    passwordHash?: string;
  } = { name, role, isActive };

  if (password.trim().length > 0) {
    if (password.length < 8) {
      throw new Error("パスワードは8文字以上で設定してください");
    }
    data.passwordHash = await hashPassword(password);
  }

  await prisma.adminUser.update({ where: { id }, data });

  await logOperation({
    adminUserId: me.id,
    action: "admin.update",
    targetType: "AdminUser",
    targetId: id,
    detail: { name, role, isActive, passwordChanged: data.passwordHash != null },
  });

  revalidatePath("/admin/admins");
  redirect("/admin/admins");
}

export async function deleteAdmin(formData: FormData) {
  const me = await requireAdmin("OWNER");
  const id = formData.get("id") as string;
  if (!id) throw new Error("管理者IDが指定されていません");
  if (id === me.id) throw new Error("自分自身を削除することはできません");

  const target = await prisma.adminUser.findUnique({ where: { id } });
  if (!target) throw new Error("対象の管理者が見つかりません");

  await prisma.adminUser.delete({ where: { id } });
  await logOperation({
    adminUserId: me.id,
    action: "admin.delete",
    targetType: "AdminUser",
    targetId: id,
    detail: { email: target.email, name: target.name },
  });

  revalidatePath("/admin/admins");
  redirect("/admin/admins");
}
