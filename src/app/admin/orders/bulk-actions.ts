"use server";

import type { OrderStatus, ShipmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

export type BulkResult = {
  successCount: number;
  failures: Array<{ orderId: string; reason: string }>;
};

/**
 * #6: 発送ステータスの一括変更。
 * 仕様書 6-2 の遷移 (UNFULFILLED→PREPARING→SHIPPED→DELIVERED, 任意→RETURNED)
 * を許可する。トランザクションは1件ずつなので失敗しても他は成功する。
 */
export async function bulkUpdateShipmentStatus(
  orderIds: string[],
  newStatus: ShipmentStatus,
): Promise<BulkResult> {
  const admin = await requireAdmin("OPERATOR");
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return { successCount: 0, failures: [] };
  }

  const result: BulkResult = { successCount: 0, failures: [] };
  const now = new Date();

  // 未払い注文 (PENDING) は発送状態変更を弾く。
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { shipment: true },
  });
  const byId = new Map(orders.map((o) => [o.id, o]));

  for (const orderId of orderIds) {
    const order = byId.get(orderId);
    if (!order) {
      result.failures.push({ orderId, reason: "注文が見つかりません" });
      continue;
    }
    if (order.status === "PENDING") {
      result.failures.push({
        orderId,
        reason: "未決済のため発送状態を変更できません",
      });
      continue;
    }
    try {
      await prisma.$transaction(async (tx) => {
        await tx.shipment.upsert({
          where: { orderId },
          create: {
            orderId,
            status: newStatus,
            shippedAt: newStatus === "SHIPPED" ? now : null,
            deliveredAt: newStatus === "DELIVERED" ? now : null,
          },
          update: {
            status: newStatus,
            shippedAt:
              newStatus === "SHIPPED" ? now : order.shipment?.shippedAt,
            deliveredAt:
              newStatus === "DELIVERED" ? now : order.shipment?.deliveredAt,
          },
        });
      });
      result.successCount++;
    } catch (e) {
      result.failures.push({
        orderId,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await logOperation({
    adminUserId: admin.id,
    action: "shipment.bulk_status_update",
    targetType: "Order",
    // 代表 1件 + 全件を detail に格納 (仕様書 6-4)
    targetId: orderIds[0],
    detail: {
      newStatus,
      orderIds,
      successCount: result.successCount,
      failureCount: result.failures.length,
    },
  });

  revalidatePath("/admin/orders");
  return result;
}

/**
 * #6: 注文ステータスの一括変更。
 * PENDING→CANCELLED (未払いキャンセル) と PAID→REFUNDED (返金は別フロー)。
 * 返金の実際の支払い戻しは既存の refundOrder フロー側 (未実装なら PR-1) で
 * 別途対応する想定。ここでは Order.status を書き換えるのみ。
 */
export async function bulkUpdateOrderStatus(
  orderIds: string[],
  newStatus: OrderStatus,
): Promise<BulkResult> {
  const admin = await requireAdmin("OPERATOR");
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return { successCount: 0, failures: [] };
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, status: true },
  });
  const byId = new Map(orders.map((o) => [o.id, o]));

  const result: BulkResult = { successCount: 0, failures: [] };
  const now = new Date();

  for (const orderId of orderIds) {
    const order = byId.get(orderId);
    if (!order) {
      result.failures.push({ orderId, reason: "注文が見つかりません" });
      continue;
    }
    // 許可される遷移だけ通す
    const allowed =
      (order.status === "PENDING" && newStatus === "CANCELLED") ||
      (order.status === "PAID" && newStatus === "REFUNDED");
    if (!allowed) {
      result.failures.push({
        orderId,
        reason: `不正な遷移: ${order.status} → ${newStatus}`,
      });
      continue;
    }
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          cancelledAt: newStatus === "CANCELLED" ? now : undefined,
        },
      });
      result.successCount++;
    } catch (e) {
      result.failures.push({
        orderId,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await logOperation({
    adminUserId: admin.id,
    action: "order.bulk_status_update",
    targetType: "Order",
    targetId: orderIds[0],
    detail: {
      newStatus,
      orderIds,
      successCount: result.successCount,
      failureCount: result.failures.length,
    },
  });

  revalidatePath("/admin/orders");
  return result;
}
