"use server";

import type { ShipmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { sendShippedMail } from "@/lib/mail/sendShippedMail";
import { logOperation } from "@/lib/operation-log";
import { getStripe, isStripeConfigured } from "@/lib/payment/stripe";
import { prisma } from "@/lib/prisma";

export async function updateShipment(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const orderId = formData.get("orderId") as string;
  const status = formData.get("status") as ShipmentStatus;
  const carrier = (formData.get("carrier") as string) || null;
  const trackingNumber = (formData.get("trackingNumber") as string) || null;

  // #40: 初めて SHIPPED になった瞬間にメール送信するため、更新前の状態を保持
  const prev = await prisma.shipment.findUnique({
    where: { orderId },
    select: { status: true },
  });
  const wasNotShippedYet = prev?.status !== "SHIPPED";

  const now = new Date();
  await prisma.shipment.upsert({
    where: { orderId },
    create: { orderId, status, carrier, trackingNumber },
    update: {
      status,
      carrier,
      trackingNumber,
      shippedAt: status === "SHIPPED" ? now : undefined,
      deliveredAt: status === "DELIVERED" ? now : undefined,
    },
  });

  await logOperation({
    adminUserId: admin.id,
    action: "shipment.update",
    targetType: "Order",
    targetId: orderId,
    detail: { status },
  });

  // 発送完了通知メール (#40)。初めて SHIPPED になったときだけ送る
  // (差し替え=trackingNumber 修正で再送は避ける)
  if (status === "SHIPPED" && wasNotShippedYet) {
    void sendShippedMail(orderId).catch((err) => {
      console.error("[shipped-mail]", err);
    });
  }

  revalidatePath(`/admin/orders/${orderId}`);
}

export async function refundOrder(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const orderId = formData.get("orderId") as string;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!order || order.status !== "PAID") {
    throw new Error("返金できない注文です");
  }

  // Stripe 連携時は実際の返金を実行
  if (isStripeConfigured() && order.payment?.providerPaymentId) {
    try {
      const stripe = getStripe();
      await stripe.refunds.create({
        payment_intent: order.payment.providerPaymentId,
      });
    } catch (err) {
      console.error("[REFUND] Stripe 返金失敗", err);
      throw new Error("Stripe 返金処理に失敗しました");
    }
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: "REFUNDED" },
    }),
    prisma.payment.update({
      where: { orderId },
      data: { status: "REFUNDED", refundedAt: now },
    }),
    // 個別サイン納品: 未制作は削除、納品済はDL停止（期限切れ扱い）
    prisma.digitalDelivery.deleteMany({
      where: { orderId, status: "PENDING" },
    }),
    prisma.digitalDelivery.updateMany({
      where: { orderId, status: "READY" },
      data: { expiresAt: now },
    }),
  ]);

  await logOperation({
    adminUserId: admin.id,
    action: "order.refund",
    targetType: "Order",
    targetId: orderId,
  });

  revalidatePath(`/admin/orders/${orderId}`);
}
