"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

export async function deleteProduct(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("商品IDが指定されていません");

  const existing = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: {
        select: { _count: { select: { orderItems: true } } },
      },
    },
  });
  if (!existing) throw new Error("商品が見つかりません");

  const hasOrders = existing.variants.some((v) => v._count.orderItems > 0);
  if (hasOrders) {
    throw new Error(
      "注文履歴がある商品は削除できません。非公開にしてください。",
    );
  }

  await prisma.product.delete({ where: { id } });

  await logOperation({
    adminUserId: admin.id,
    action: "product.delete",
    targetType: "Product",
    targetId: id,
    detail: { name: existing.name },
  });

  revalidatePath("/admin/products");
  redirect("/admin/products");
}
