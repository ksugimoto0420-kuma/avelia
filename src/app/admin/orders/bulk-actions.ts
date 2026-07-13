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

/** 事前チェック結果。UI が実行前にモーダルで警告するために使う。 */
export type BulkPreview = {
  /** 遷移可能な注文数 */
  applicableCount: number;
  /** 遷移できない注文の内訳。orderId + orderNumber + 理由 */
  blocked: Array<{
    orderId: string;
    orderNumber: string;
    reason: string;
  }>;
};

/** 注文ステータス遷移の可否と理由。null = 遷移可能。 */
function checkOrderTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus,
): string | null {
  const allowed =
    (currentStatus === "PENDING" && newStatus === "CANCELLED") ||
    (currentStatus === "PAID" && newStatus === "REFUNDED");
  if (allowed) return null;
  if (currentStatus === "PAID" && newStatus === "CANCELLED") {
    // 運用アクシデントで支払い済み注文を取り消したいケースの誤操作対策
    return "支払済のため直接キャンセルできません。返金 (REFUNDED) を選択してください";
  }
  if (currentStatus === newStatus) {
    return "既に同じステータスです";
  }
  return `${currentStatus} から ${newStatus} には変更できません`;
}

/** 発送ステータス遷移の可否と理由。null = 遷移可能。 */
function checkShipmentTransition(
  orderStatus: OrderStatus,
): string | null {
  if (orderStatus === "PENDING") {
    return "未決済のため発送状態を変更できません";
  }
  if (orderStatus === "CANCELLED" || orderStatus === "REFUNDED") {
    return `注文が ${orderStatus} のため発送状態を変更できません`;
  }
  return null;
}

/**
 * 一括変更前のプレビュー。UI が確認モーダルで
 * 「N件変更可能 / M件は不正な遷移 (理由)」を出すために叩く。
 * 実際の書き込みは行わない (副作用なし・冪等)。
 */
export async function previewBulkStatus(
  orderIds: string[],
  kind: "shipment" | "order",
  newStatus: string,
): Promise<BulkPreview> {
  await requireAdmin("OPERATOR");
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return { applicableCount: 0, blocked: [] };
  }
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, orderNumber: true, status: true },
  });
  const byId = new Map(orders.map((o) => [o.id, o]));
  const blocked: BulkPreview["blocked"] = [];
  let applicable = 0;
  for (const id of orderIds) {
    const o = byId.get(id);
    if (!o) {
      blocked.push({
        orderId: id,
        orderNumber: id,
        reason: "注文が見つかりません",
      });
      continue;
    }
    const reason =
      kind === "shipment"
        ? checkShipmentTransition(o.status)
        : checkOrderTransition(o.status, newStatus as OrderStatus);
    if (reason) {
      blocked.push({
        orderId: o.id,
        orderNumber: o.orderNumber,
        reason,
      });
    } else {
      applicable++;
    }
  }
  return { applicableCount: applicable, blocked };
}

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
    const blockReason = checkShipmentTransition(order.status);
    if (blockReason) {
      result.failures.push({ orderId, reason: blockReason });
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
    const blockReason = checkOrderTransition(order.status, newStatus);
    if (blockReason) {
      result.failures.push({ orderId, reason: blockReason });
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
