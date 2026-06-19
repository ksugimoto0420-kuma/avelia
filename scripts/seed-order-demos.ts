/**
 * デモ用に、注文管理・決済管理で「不足しているステータス」のサンプル注文を
 * 1 件ずつ作る。
 *
 * 流用元: 既存の PAID 注文（最初に見つかった 1 件）の明細・金額・住所を
 *         そのまま複製し、ステータスだけ変えた注文を作成する。
 *
 * 冪等: 注文番号に固有のサフィックス（"DEMO-PENDING" 等）を持たせ、
 *       既に同じ番号が存在すればスキップする。
 *
 * 不足ステータス（2026-06-19 時点で本番に 0 件）:
 *  - Order.status      : PENDING / REFUNDED / FAILED
 *  - Payment.status    : PENDING / AUTHORIZED / REFUNDED / FAILED
 */
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

type DemoSpec = {
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  description: string;
  paidAt: Date | null;
  cancelledAt: Date | null;
  // 決済の providerPaymentId / failureReason は demo っぽい値を入れる
  providerPaymentId: string | null;
  failureReason: string | null;
};

function addMin(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

async function main() {
  const now = new Date();

  const template = await prisma.order.findFirst({
    where: { status: "PAID" },
    include: {
      items: {
        include: { variant: { include: { product: true } } },
      },
    },
  });
  if (!template) throw new Error("流用元の PAID 注文が見つかりません");

  console.log(
    `テンプレート: ${template.orderNumber} / items=${template.items.length} / total=${template.total}`,
  );

  // ステータス組み合わせ
  const specs: DemoSpec[] = [
    {
      orderNumber: "AV-DEMO-PENDING",
      orderStatus: "PENDING",
      paymentStatus: "PENDING",
      description: "決済未完了（PaymentIntent 待ち）デモ",
      paidAt: null,
      cancelledAt: null,
      providerPaymentId: null,
      failureReason: null,
    },
    {
      orderNumber: "AV-DEMO-AUTHORIZED",
      orderStatus: "PENDING",
      paymentStatus: "AUTHORIZED",
      description: "与信のみ完了（売上未確定）デモ",
      paidAt: null,
      cancelledAt: null,
      providerPaymentId: "pi_demo_authorized",
      failureReason: null,
    },
    {
      orderNumber: "AV-DEMO-REFUND",
      orderStatus: "REFUNDED",
      paymentStatus: "REFUNDED",
      description: "返金完了デモ",
      paidAt: addMin(now, -60 * 24 * 3),
      cancelledAt: null,
      providerPaymentId: "pi_demo_refunded",
      failureReason: null,
    },
    {
      orderNumber: "AV-DEMO-FAIL",
      orderStatus: "FAILED",
      paymentStatus: "FAILED",
      description: "決済失敗デモ",
      paidAt: null,
      cancelledAt: null,
      providerPaymentId: null,
      failureReason: "card_declined（デモ用ダミー）",
    },
  ];

  for (const s of specs) {
    const existing = await prisma.order.findUnique({
      where: { orderNumber: s.orderNumber },
      select: { id: true },
    });
    if (existing) {
      console.log(`[${s.orderStatus}] 既に存在: ${s.orderNumber} → スキップ`);
      continue;
    }

    const created = await prisma.order.create({
      data: {
        orderNumber: s.orderNumber,
        userId: template.userId,
        status: s.orderStatus,
        subtotal: template.subtotal,
        shippingFee: template.shippingFee,
        total: template.total,
        recipientName: template.recipientName,
        recipientKana: template.recipientKana,
        recipientPhone: template.recipientPhone,
        recipientPostal: template.recipientPostal,
        recipientAddress: template.recipientAddress,
        shippingMethod: template.shippingMethod,
        paidAt: s.paidAt,
        cancelledAt: s.cancelledAt,
        items: {
          create: template.items.map((i) => ({
            variantId: i.variantId,
            productName: i.productName,
            variantName: i.variantName,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            nickname: i.nickname,
            nicknameKana: i.nicknameKana,
            note: i.note,
            unitNicknames: i.unitNicknames ?? undefined,
          })),
        },
        payment: {
          create: {
            provider: "STRIPE",
            status: s.paymentStatus,
            amount: template.total,
            currency: "jpy",
            paidAt: s.paymentStatus === "PAID" ? s.paidAt : null,
            refundedAt: s.paymentStatus === "REFUNDED" ? addMin(now, -60) : null,
            providerPaymentId: s.providerPaymentId,
            failureReason: s.failureReason,
          },
        },
      },
      select: { id: true, orderNumber: true },
    });
    console.log(
      `[${s.orderStatus}/${s.paymentStatus}] 作成: ${created.orderNumber} (id=${created.id}) — ${s.description}`,
    );
  }

  console.log("✅ done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
