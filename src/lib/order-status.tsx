import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { confirmStock, releaseStock } from "@/lib/inventory";
import { sendMailTemplate } from "@/lib/mail";
import { OrderConfirmationMail } from "@/lib/mail/templates/OrderConfirmationMail";
import { normalizeUnitNicknames } from "@/lib/nickname";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

/**
 * 注文を支払済みにする（決済成功 Webhook から呼ばれる）。
 * - 在庫を正式減算（reserved → sold）
 * - 仮確保を CONFIRMED に
 * - 物販があれば shipment(UNFULFILLED) を作成
 * - デジタルコンテンツ閲覧権限を付与
 * - 当選応募があれば PURCHASED に
 * 既に PAID の場合は冪等にスキップ。
 */
export async function markOrderPaid(params: {
  orderId: string;
  providerPaymentId?: string | null;
  providerSessionId?: string | null;
  rawEvent?: unknown;
  now?: Date;
}) {
  const { orderId } = params;
  const now = params.now ?? new Date();

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        payment: true,
      },
    });
    if (!order) return { changed: false as const };
    if (order.status === "PAID") return { changed: false as const, order };

    // 在庫確定 & 仮確保 CONFIRMED
    for (const item of order.items) {
      await confirmStock(tx, item.variantId, item.quantity);
    }
    await tx.stockReservation.updateMany({
      where: { orderItem: { orderId } },
      data: { status: "CONFIRMED" },
    });

    // 注文・決済ステータス更新
    await tx.order.update({
      where: { id: orderId },
      data: { status: "PAID", paidAt: now },
    });
    await tx.payment.update({
      where: { orderId },
      data: {
        status: "PAID",
        paidAt: now,
        providerPaymentId: params.providerPaymentId ?? undefined,
        providerSessionId: params.providerSessionId ?? undefined,
        rawEvent: (params.rawEvent as Prisma.InputJsonValue) ?? undefined,
      },
    });

    // 物販があれば発送レコード
    const hasPhysical = order.items.some(
      (i) => i.variant.product.type === "PHYSICAL",
    );
    if (hasPhysical) {
      await tx.shipment.upsert({
        where: { orderId },
        create: { orderId, status: "UNFULFILLED" },
        update: {},
      });
    }

    // デジタルコンテンツ付与
    for (const item of order.items) {
      if (item.variant.product.type !== "DIGITAL") continue;
      const contents = await tx.digitalContent.findMany({
        where: { productId: item.variant.product.id },
      });
      const units = normalizeUnitNicknames(item.unitNicknames, item.quantity, {
        nickname: item.nickname,
        nicknameKana: item.nicknameKana,
        note: item.note,
      });
      for (const c of contents) {
        if (c.deliveryType === "PERSONALIZED") {
          // 個別サイン納品: 数量分の納品タスクを PENDING で生成（期限はREADY時に設定）
          for (let unitIndex = 0; unitIndex < item.quantity; unitIndex++) {
            const u = units[unitIndex];
            await tx.digitalDelivery.upsert({
              where: {
                orderItemId_digitalContentId_unitIndex: {
                  orderItemId: item.id,
                  digitalContentId: c.id,
                  unitIndex,
                },
              },
              create: {
                digitalContentId: c.id,
                orderId: order.id,
                orderItemId: item.id,
                userId: order.userId,
                unitIndex,
                nickname: u?.nickname ?? null,
                nicknameKana: u?.nicknameKana ?? null,
                note: u?.note ?? null,
                status: "PENDING",
              },
              update: {}, // 既存はそのまま（READY上書き防止・冪等）
            });
          }
          continue;
        }
        // SHARED: 従来どおり共通ファイルの閲覧権限を付与
        const expiresAt = c.viewLimitDays
          ? new Date(now.getTime() + c.viewLimitDays * 24 * 60 * 60 * 1000)
          : null;
        await tx.userDigitalContent.upsert({
          where: {
            userId_digitalContentId: {
              userId: order.userId,
              digitalContentId: c.id,
            },
          },
          create: {
            userId: order.userId,
            digitalContentId: c.id,
            orderId: order.id,
            expiresAt,
          },
          update: {},
        });
      }
    }

    // 当選応募を PURCHASED に
    await tx.lotteryEntry.updateMany({
      where: { userId: order.userId, status: "WON" },
      data: { status: "PURCHASED", orderId },
    });

    return { changed: true as const, order };
  });

  // メール送信（トランザクション外）
  if (result.changed && result.order) {
    await sendOrderConfirmationMail(result.order.id).catch((err) => {
      // メール失敗で注文完了フロー自体を止めない
      console.error("[order-status] 注文確認メール送信失敗", err);
    });
  }

  return result;
}

/**
 * 注文をキャンセル/失敗にし、仮確保を解放する。
 * 決済キャンセル・期限切れ時に呼ぶ。PAID 済みは解放しない（冪等）。
 */
export async function releaseOrder(params: {
  orderId: string;
  orderStatus: OrderStatus; // CANCELLED | FAILED
  paymentStatus: PaymentStatus; // CANCELLED | FAILED
  reason?: string;
  now?: Date;
}) {
  const { orderId, orderStatus, paymentStatus } = params;
  const now = params.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return { changed: false as const };
    if (order.status !== "PENDING") return { changed: false as const, order };

    // 仮確保を解放
    for (const item of order.items) {
      const res = await tx.stockReservation.findUnique({
        where: { orderItemId: item.id },
      });
      if (res && res.status === "HELD") {
        await releaseStock(tx, item.variantId, item.quantity);
      }
    }
    await tx.stockReservation.updateMany({
      where: { orderItem: { orderId }, status: "HELD" },
      data: { status: "RELEASED" },
    });

    await tx.order.update({
      where: { id: orderId },
      data: { status: orderStatus, cancelledAt: now },
    });
    await tx.payment.update({
      where: { orderId },
      data: { status: paymentStatus, failureReason: params.reason ?? null },
    });

    return { changed: true as const, order };
  });
}

/**
 * 注文確認メール送信 (Stripe webhook から呼ばれる markOrderPaid の後段)。
 * 冪等性は呼び出し元 (result.changed) 側で担保されているため、ここでは
 * 送信のみを実施する。運営宛 Bcc は ALERT_EMAIL_TO を活用する。
 */
async function sendOrderConfirmationMail(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: { select: { name: true, deliveryDate: true } },
            },
          },
        },
      },
      user: { select: { email: true, name: true } },
    },
  });
  if (!order || !order.user) return;

  const lines = order.items.map((item) => ({
    productName: item.variant.product.name,
    variantName:
      item.variant.name && item.variant.name !== "標準"
        ? item.variant.name
        : null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));

  // 最も遅い deliveryDate を目安として提示 (物販/デジタルどちらでも product に紐づく)。
  const deliveryDates = order.items
    .map((i) => i.variant.product.deliveryDate)
    .filter((d): d is Date => d instanceof Date);
  const latestDeliveryDate =
    deliveryDates.length > 0
      ? new Date(Math.max(...deliveryDates.map((d) => d.getTime())))
      : null;

  const shippingAddress =
    order.recipientAddress || order.recipientPostal
      ? {
          name: order.recipientName ?? order.user.name,
          postalCode: order.recipientPostal,
          address: order.recipientAddress,
        }
      : null;

  const paidAt = formatDate(order.paidAt ?? new Date());
  const mypageUrl = `${env.appUrl}/mypage/orders/${order.id}`;

  const bcc = env.alertEmailTo
    ? env.alertEmailTo.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  await sendMailTemplate({
    to: order.user.email,
    subject: `【Avelia FunClub】ご注文ありがとうございます (${order.orderNumber})`,
    bcc,
    template: (
      <OrderConfirmationMail
        orderNumber={order.orderNumber}
        paidAt={paidAt}
        customerName={order.user.name}
        lines={lines}
        totalAmount={order.total}
        deliveryEta={latestDeliveryDate ? formatDate(latestDeliveryDate) : null}
        shippingAddress={shippingAddress}
        mypageUrl={mypageUrl}
      />
    ),
  });
}
