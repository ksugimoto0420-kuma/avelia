import { prisma } from "@/lib/prisma";

// R/S 収益管理（仕様書 11）。
// 対象売上 = 決済完了済み かつ 返金されていない注文売上。
// イベント別に当月分を集計し、弊社/Avelia の取り分を算出する。
// 取り分率や手数料の扱いは契約条件として conditions に保存する。

export const DEFAULT_OUR_SHARE_RATE = 0.7; // 弊社取り分の既定値

/** "YYYY-MM" の期間から開始・終了日時を得る。 */
function periodRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

/**
 * 指定月のイベント別 R/S を再計算して revenue_shares に保存する。
 * 既存の同一(event, period) レコードは置き換える。
 */
export async function computeRevenueSharesForPeriod(
  period: string,
  ourShareRate: number = DEFAULT_OUR_SHARE_RATE,
) {
  const { start, end } = periodRange(period);

  // 当月に支払われ、返金されていない注文を対象にイベント別集計
  const rows = await prisma.$queryRaw<
    Array<{ eventId: string; gross: bigint | null; shipping: bigint | null }>
  >`
    SELECT p."eventId" AS "eventId",
           COALESCE(SUM(oi."unitPrice" * oi.quantity), 0) AS gross,
           0 AS shipping
    FROM order_items oi
    JOIN orders o ON o.id = oi."orderId"
    JOIN product_variants pv ON pv.id = oi."variantId"
    JOIN products p ON p.id = pv."productId"
    WHERE o.status = 'PAID'
      AND o."paidAt" >= ${start}
      AND o."paidAt" < ${end}
    GROUP BY p."eventId"`;

  const results = [];
  for (const r of rows) {
    const grossSales = Number(r.gross ?? 0);
    const ourAmount = Math.round(grossSales * ourShareRate);
    const aveliaAmount = grossSales - ourAmount;

    // 同一 (event, period) を置き換え
    await prisma.revenueShare.deleteMany({
      where: { eventId: r.eventId, productId: null, period },
    });
    const created = await prisma.revenueShare.create({
      data: {
        eventId: r.eventId,
        period,
        grossSales,
        paymentFee: 0,
        shippingFee: Number(r.shipping ?? 0),
        refunds: 0,
        externalCost: 0,
        ourShareRate,
        ourAmount,
        aveliaAmount,
        conditions: { ourShareRate, note: "自動集計（手数料・外部費は未反映）" },
      },
    });
    results.push(created);
  }
  return results;
}
