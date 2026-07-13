"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { EMAIL_TEMPLATE_SPECS, type TemplateKind } from "@/lib/mail/templates-registry";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

function assertKind(raw: string): TemplateKind {
  if (!(raw in EMAIL_TEMPLATE_SPECS)) {
    throw new AppError("不正な種別です", 400);
  }
  return raw as TemplateKind;
}

/**
 * テンプレを保存する (upsert)。空欄で来た場合はデフォルトが使われるが、
 * 保存すれば以降は DB のカスタムが優先される。
 */
export async function saveMailTemplate(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const kind = assertKind(String(formData.get("kind") ?? ""));
  const subject = String(formData.get("subject") ?? "").trim();
  const bodyText = String(formData.get("bodyText") ?? "");

  if (!subject) throw new AppError("件名は必須です", 400);
  if (!bodyText.trim()) throw new AppError("本文は必須です", 400);

  await prisma.emailTemplate.upsert({
    where: { kind },
    create: { kind, subject, bodyText },
    update: { subject, bodyText },
  });

  await logOperation({
    adminUserId: admin.id,
    action: "email_template.update",
    targetType: "EmailTemplate",
    targetId: kind,
  });

  revalidatePath("/admin/settings/mail-templates");
  revalidatePath(`/admin/settings/mail-templates/${kind}`);
  redirect("/admin/settings/mail-templates");
}

/**
 * カスタムを削除して既定 (React Email テンプレ) に戻す。
 */
export async function resetMailTemplate(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const kind = assertKind(String(formData.get("kind") ?? ""));

  await prisma.emailTemplate
    .delete({ where: { kind } })
    .catch(() => {
      // 既に削除済みなら無視 (冪等)
    });

  await logOperation({
    adminUserId: admin.id,
    action: "email_template.reset",
    targetType: "EmailTemplate",
    targetId: kind,
  });

  revalidatePath("/admin/settings/mail-templates");
  revalidatePath(`/admin/settings/mail-templates/${kind}`);
  redirect("/admin/settings/mail-templates");
}
