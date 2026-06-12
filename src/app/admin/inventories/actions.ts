"use server";

import { revalidatePath } from "next/cache";
import type { AdjustmentReason } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

const VALID_REASONS: AdjustmentReason[] = [
  "INITIAL",
  "RESTOCK",
  "LOSS",
  "RETURN",
  "STOCKTAKE",
  "CORRECTION",
  "CSV_IMPORT",
  "OTHER",
];

export async function adjustInventory(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const variantId = formData.get("variantId") as string;
  const quantity = Number(formData.get("quantity"));
  const reason = (formData.get("reason") as AdjustmentReason) ?? "CORRECTION";
  const note = (formData.get("note") as string | null)?.trim() || null;
  if (!variantId || Number.isNaN(quantity) || quantity < 0) {
    throw new Error("数量は0以上の整数で入力してください");
  }
  if (!VALID_REASONS.includes(reason)) {
    throw new Error("理由の指定が不正です");
  }

  await prisma.$transaction(async (tx) => {
    const before = await tx.inventory.upsert({
      where: { variantId },
      create: { variantId, quantity: 0 },
      update: {},
    });
    const delta = quantity - before.quantity;
    if (delta === 0) return;

    const updated = await tx.inventory.update({
      where: { variantId },
      data: { quantity },
    });

    await tx.inventoryAdjustment.create({
      data: {
        inventoryId: updated.id,
        variantId,
        delta,
        before: before.quantity,
        after: quantity,
        reason,
        note,
        adminUserId: admin.id,
      },
    });
  });

  await logOperation({
    adminUserId: admin.id,
    action: "inventory.adjust",
    targetType: "Inventory",
    targetId: variantId,
    detail: { quantity, reason, note },
  });

  revalidatePath("/admin/inventories");
  revalidatePath(`/admin/inventories/${variantId}`);
}

export async function setLowStockThreshold(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const variantId = formData.get("variantId") as string;
  const raw = formData.get("threshold") as string | null;
  if (!variantId) throw new Error("variantIdが必要です");

  const threshold =
    raw == null || raw.trim() === "" ? null : Math.max(0, Math.trunc(Number(raw)));
  if (threshold !== null && Number.isNaN(threshold)) {
    throw new Error("閾値の指定が不正です");
  }

  await prisma.inventory.update({
    where: { variantId },
    data: {
      lowStockThreshold: threshold,
      lowStockAlertedAt: null, // 閾値を変えたらアラート抑制をリセット
    },
  });

  await logOperation({
    adminUserId: admin.id,
    action: "inventory.set_threshold",
    targetType: "Inventory",
    targetId: variantId,
    detail: { threshold },
  });

  revalidatePath("/admin/inventories");
  revalidatePath(`/admin/inventories/${variantId}`);
}
