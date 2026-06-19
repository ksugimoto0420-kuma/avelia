/**
 * デモ用の AV-DEMO-* 注文の paidAt/refundedAt/cancelledAt を「今」に揃える。
 * - 返金は paidAt が立っていないと違和感が強いので、Payment.paidAt も埋める
 * - createdAt はそのまま（投入時刻のまま）
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const now = new Date();
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);

  // REFUNDED: 60 分前に支払 → 5 分前に返金
  const refund = await prisma.order.findUnique({
    where: { orderNumber: "AV-DEMO-REFUND" },
    select: { id: true },
  });
  if (refund) {
    await prisma.order.update({
      where: { id: refund.id },
      data: { paidAt: minutesAgo(60) },
    });
    await prisma.payment.update({
      where: { orderId: refund.id },
      data: {
        paidAt: minutesAgo(60),
        refundedAt: minutesAgo(5),
      },
    });
    console.log("AV-DEMO-REFUND: paidAt(60分前)・refundedAt(5分前) に更新");
  }

  // PENDING / AUTHORIZED / FAILED は paidAt 無しで OK。失敗側だけ更新時刻を今に。
  const failed = await prisma.order.findUnique({
    where: { orderNumber: "AV-DEMO-FAIL" },
    select: { id: true },
  });
  if (failed) {
    await prisma.payment.update({
      where: { orderId: failed.id },
      data: { updatedAt: now },
    });
    console.log("AV-DEMO-FAIL: payment.updatedAt を現在に");
  }

  console.log("✅ done");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
