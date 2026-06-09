"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

export async function adjustInventory(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const variantId = formData.get("variantId") as string;
  const quantity = Number(formData.get("quantity"));
  if (!variantId || Number.isNaN(quantity) || quantity < 0) {
    throw new Error("入力が不正です");
  }

  await prisma.inventory.upsert({
    where: { variantId },
    create: { variantId, quantity },
    update: { quantity },
  });

  await logOperation({
    adminUserId: admin.id,
    action: "inventory.adjust",
    targetType: "Inventory",
    targetId: variantId,
    detail: { quantity },
  });

  revalidatePath("/admin/inventories");
}
