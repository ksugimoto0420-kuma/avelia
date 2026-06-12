"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

import { parseJstDateTimeLocal } from "@/lib/utils";

function parseDate(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || v.trim() === "") return null;
  return parseJstDateTimeLocal(v);
}

function parseIntOrNull(v: FormDataEntryValue | null): number | null {
  if (!v || typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : Math.trunc(n);
}

export async function saveEvent(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");

  const id = formData.get("id") as string | null;
  const title = (formData.get("title") as string)?.trim();
  if (!title) throw new Error("タイトルは必須です");

  const slug =
    (formData.get("slug") as string)?.trim() || slugify(title) || `event-${Date.now()}`;

  const eventType = (formData.get("eventType") as string) || "MEET_GREET";
  const saleMethod = (formData.get("saleMethod") as string) || "FIRST_COME";

  const data = {
    title,
    slug,
    description: (formData.get("description") as string) || null,
    coverImageUrl: (formData.get("coverImageUrl") as string) || null,
    artistName: (formData.get("artistName") as string) || null,
    eventType: eventType as "MEET_GREET" | "KUJI" | "TRADING_CARD" | "GOODS",
    saleMethod: saleMethod as "FIRST_COME" | "LOTTERY",
    eventDate: parseDate(formData.get("eventDate")),
    streamingUrl: (formData.get("streamingUrl") as string)?.trim() || null,
    isPublished: formData.get("isPublished") === "on",
    saleStartAt: parseDate(formData.get("saleStartAt")),
    saleEndAt: parseDate(formData.get("saleEndAt")),
    maxPerUser: parseIntOrNull(formData.get("maxPerUser")),
    capacity: parseIntOrNull(formData.get("capacity")),
    notes: (formData.get("notes") as string) || null,
  };

  if (id) {
    await prisma.event.update({ where: { id }, data });
    await logOperation({
      adminUserId: admin.id,
      action: "event.update",
      targetType: "Event",
      targetId: id,
    });
  } else {
    const created = await prisma.event.create({ data });
    await logOperation({
      adminUserId: admin.id,
      action: "event.create",
      targetType: "Event",
      targetId: created.id,
    });
  }

  revalidatePath("/admin/events");
  redirect("/admin/events");
}

export async function toggleEventPublish(id: string, next: boolean) {
  const admin = await requireAdmin("OPERATOR");
  await prisma.event.update({ where: { id }, data: { isPublished: next } });
  await logOperation({
    adminUserId: admin.id,
    action: next ? "event.publish" : "event.unpublish",
    targetType: "Event",
    targetId: id,
  });
  revalidatePath("/admin/events");
}

export async function deleteEvent(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("イベントIDが指定されていません");

  const existing = await prisma.event.findUnique({
    where: { id },
    include: {
      products: {
        include: {
          variants: { select: { _count: { select: { orderItems: true } } } },
        },
      },
    },
  });
  if (!existing) throw new Error("イベントが見つかりません");

  const orderCount = existing.products.reduce(
    (sum, p) =>
      sum + p.variants.reduce((s, v) => s + v._count.orderItems, 0),
    0,
  );
  if (orderCount > 0) {
    throw new Error(
      "注文履歴がある商品を含むイベントは削除できません。非公開にしてください。",
    );
  }

  await prisma.event.delete({ where: { id } });

  await logOperation({
    adminUserId: admin.id,
    action: "event.delete",
    targetType: "Event",
    targetId: id,
    detail: { title: existing.title, productsCount: existing.products.length },
  });

  revalidatePath("/admin/events");
  redirect("/admin/events");
}
