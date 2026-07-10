"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";
import { parseJstDateTimeLocal } from "@/lib/utils";

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

export async function saveNewsPost(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");

  const id = (formData.get("id") as string | null) ?? "";
  const title = ((formData.get("title") as string) ?? "").trim();
  const rawSlug = ((formData.get("slug") as string) ?? "").trim();
  const body = ((formData.get("body") as string) ?? "").trim();
  const isPublished = formData.get("isPublished") === "on";
  const publishedAtRaw = ((formData.get("publishedAt") as string) ?? "").trim();

  if (!title) throw new Error("タイトルは必須です");
  if (!body) throw new Error("本文は必須です");

  const slug = rawSlug ? normalizeSlug(rawSlug) : normalizeSlug(title);
  if (!slug) throw new Error("slug を英数字ハイフンで指定してください");

  const publishedAt = publishedAtRaw ? parseJstDateTimeLocal(publishedAtRaw) : null;

  const data = { title, slug, body, isPublished, publishedAt };

  if (id) {
    await prisma.newsPost.update({ where: { id }, data });
    await logOperation({
      adminUserId: admin.id,
      action: "news.update",
      targetType: "NewsPost",
      targetId: id,
    });
  } else {
    const created = await prisma.newsPost.create({ data });
    await logOperation({
      adminUserId: admin.id,
      action: "news.create",
      targetType: "NewsPost",
      targetId: created.id,
    });
  }

  revalidatePath("/admin/news");
  revalidatePath("/news");
  redirect("/admin/news");
}

export async function toggleNewsPublish(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const id = (formData.get("id") as string | null) ?? "";
  if (!id) throw new Error("id が指定されていません");
  const existing = await prisma.newsPost.findUnique({ where: { id } });
  if (!existing) throw new Error("記事が見つかりません");
  await prisma.newsPost.update({
    where: { id },
    data: { isPublished: !existing.isPublished },
  });
  await logOperation({
    adminUserId: admin.id,
    action: "news.togglePublish",
    targetType: "NewsPost",
    targetId: id,
    detail: { isPublished: !existing.isPublished },
  });
  revalidatePath("/admin/news");
  revalidatePath("/news");
}

export async function deleteNewsPost(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const id = (formData.get("id") as string | null) ?? "";
  if (!id) throw new Error("id が指定されていません");
  await prisma.newsPost.delete({ where: { id } });
  await logOperation({
    adminUserId: admin.id,
    action: "news.delete",
    targetType: "NewsPost",
    targetId: id,
  });
  revalidatePath("/admin/news");
  revalidatePath("/news");
}
