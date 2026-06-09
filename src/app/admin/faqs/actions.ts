"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

function parseIntOr(v: FormDataEntryValue | null, fallback: number): number {
  if (!v || typeof v !== "string" || v.trim() === "") return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : Math.trunc(n);
}

export async function saveFaq(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");

  const id = formData.get("id") as string | null;
  const question = (formData.get("question") as string)?.trim();
  const answer = (formData.get("answer") as string)?.trim();
  if (!question || !answer) {
    throw new Error("質問と回答は必須です");
  }
  const sortOrder = parseIntOr(formData.get("sortOrder"), 0);
  const isPublished = formData.get("isPublished") === "on";

  if (id) {
    await prisma.faq.update({
      where: { id },
      data: { question, answer, sortOrder, isPublished },
    });
    await logOperation({
      adminUserId: admin.id,
      action: "faq.update",
      targetType: "Faq",
      targetId: id,
    });
  } else {
    const created = await prisma.faq.create({
      data: { question, answer, sortOrder, isPublished },
    });
    await logOperation({
      adminUserId: admin.id,
      action: "faq.create",
      targetType: "Faq",
      targetId: created.id,
    });
  }

  revalidatePath("/admin/faqs");
  revalidatePath("/faq");
  redirect("/admin/faqs");
}

export async function toggleFaqPublish(id: string, next: boolean) {
  const admin = await requireAdmin("OPERATOR");
  await prisma.faq.update({ where: { id }, data: { isPublished: next } });
  await logOperation({
    adminUserId: admin.id,
    action: next ? "faq.publish" : "faq.unpublish",
    targetType: "Faq",
    targetId: id,
  });
  revalidatePath("/admin/faqs");
  revalidatePath("/faq");
}

export async function deleteFaq(id: string) {
  const admin = await requireAdmin("MANAGER");
  await prisma.faq.delete({ where: { id } });
  await logOperation({
    adminUserId: admin.id,
    action: "faq.delete",
    targetType: "Faq",
    targetId: id,
  });
  revalidatePath("/admin/faqs");
  revalidatePath("/faq");
}
