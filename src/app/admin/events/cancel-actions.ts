"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { env } from "@/lib/env";
import { sendTemplatedMail } from "@/lib/mail/resolveTemplate";
import { EventCancelledMail } from "@/lib/mail/templates/EventCancelledMail";
import { logOperation } from "@/lib/operation-log";
import { getStripe, isStripeConfigured } from "@/lib/payment/stripe";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

export type EventCancelPreview = {
  targetOrderCount: number;
  totalRefundAmount: number;
};

/**
 * イベントキャンセル前のプレビュー。対象注文数 + 返金総額を返す。
 */
export async function previewEventCancel(
  eventId: string,
): Promise<EventCancelPreview> {
  await requireAdmin("MANAGER");
  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      items: { some: { variant: { product: { eventId } } } },
    },
    select: { id: true, total: true },
  });
  return {
    targetOrderCount: orders.length,
    totalRefundAmount: orders.reduce((s, o) => s + o.total, 0),
  };
}

export type EventCancelResult = {
  refundedCount: number;
  failures: Array<{ orderId: string; orderNumber: string; reason: string }>;
  eventUnpublished: boolean;
};

/**
 * イベントを開催中止扱いにして、対象の PAID 注文を一括で返金 + 通知メール送信。
 *
 * - Stripe Refund を1件ずつ発行 (途中失敗は個別スキップ)
 * - 成功したものは Order.status = REFUNDED / Payment.refundedAt を記録
 * - DigitalDelivery は PENDING を削除、READY は expiresAt を今にして DL 停止
 * - イベントは isPublished = false に落とす (新規購入を止めるため)
 * - メールは開催中止テンプレを送信
 */
export async function cancelEvent(formData: FormData): Promise<EventCancelResult> {
  const admin = await requireAdmin("MANAGER");
  const eventId = String(formData.get("eventId") ?? "");
  const reason = (formData.get("reason") as string | null)?.trim() || null;
  if (!eventId) throw new AppError("eventId が必要です", 400);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, isPublished: true },
  });
  if (!event) throw new AppError("イベントが見つかりません", 404);

  // 対象注文を確定させる (PAID のみ、REFUNDED / CANCELLED は対象外)
  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      items: { some: { variant: { product: { eventId } } } },
    },
    include: {
      user: { select: { email: true, name: true } },
      payment: true,
    },
  });

  const now = new Date();
  const siteName = await getSetting("siteName");
  const result: EventCancelResult = {
    refundedCount: 0,
    failures: [],
    eventUnpublished: false,
  };

  for (const order of orders) {
    try {
      // Stripe が設定されているケースだけ実際の返金 API を叩く
      if (isStripeConfigured() && order.payment?.providerPaymentId) {
        const stripe = getStripe();
        await stripe.refunds.create({
          payment_intent: order.payment.providerPaymentId,
        });
      }
      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: { status: "REFUNDED" },
        }),
        prisma.payment.update({
          where: { orderId: order.id },
          data: { status: "REFUNDED", refundedAt: now },
        }),
        prisma.digitalDelivery.deleteMany({
          where: { orderId: order.id, status: "PENDING" },
        }),
        prisma.digitalDelivery.updateMany({
          where: { orderId: order.id, status: "READY" },
          data: { expiresAt: now },
        }),
      ]);
      result.refundedCount++;

      // 通知メール (Bcc は付けない: 個別通知)
      if (order.user.email) {
        const orderUrl = `${env.appUrl}/mypage/orders/${order.id}`;
        await sendTemplatedMail({
          kind: "EVENT_CANCELLED",
          to: order.user.email,
          variables: {
            siteName,
            userName: order.user.name ?? "",
            eventTitle: event.title,
            orderNumber: order.orderNumber,
            refundAmount: `¥${order.total.toLocaleString("ja-JP")}`,
            reason: reason ?? "",
            orderUrl,
          },
          fallback: {
            subject: `【${siteName}】「${event.title}」開催中止のお知らせ`,
            template: EventCancelledMail({
              customerName: order.user.name,
              eventTitle: event.title,
              orderNumber: order.orderNumber,
              reason,
              refundAmount: order.total,
              orderUrl,
            }),
          },
          idempotencyKey: `event-cancelled:${event.id}:${order.id}`,
        });
      }
    } catch (e) {
      result.failures.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // イベントを非公開化 (新規購入を止める)
  if (event.isPublished) {
    await prisma.event.update({
      where: { id: eventId },
      data: { isPublished: false },
    });
    result.eventUnpublished = true;
  }

  await logOperation({
    adminUserId: admin.id,
    action: "event.cancel",
    targetType: "Event",
    targetId: eventId,
    detail: {
      reason,
      targetCount: orders.length,
      refundedCount: result.refundedCount,
      failureCount: result.failures.length,
    },
  });

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/orders");
  return result;
}
