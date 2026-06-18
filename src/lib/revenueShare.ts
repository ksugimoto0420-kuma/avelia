import { prisma } from "@/lib/prisma";
import { getSettingFloat, getSettingInt } from "@/lib/settings";

// R/S 収益管理（仕様書 11）。
// 対象売上 = 決済完了済み かつ 返金されていない注文売上。
// イベント別に当月分を集計し、決済手数料・弊社/Avelia の取り分を算出する。
//
// 弊社取り分率は「月次グロス売上に応じたシンプル階段制（3段）」を採用する。
// 設定は管理画面のサイト設定で変更可能。
//   Tier1 : 月次グロス < rsTier1Threshold        → rsTier1Rate（例: 3%）
//   Tier2 : Tier1閾値 〜 < rsTier2Threshold      → rsTier2Rate（例: 5%）
//   Tier3 : Tier2閾値 以上                       → rsTier3Rate（例: 10%）
// イベント別の取り分率はこの「月次合計に対する階段」を全イベントに同率で適用する。

/** "YYYY-MM" の期間から開始・終了日時を得る。 */
function periodRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

/** 月次グロス売上に応じた弊社取り分率を返す（階段制） */
function selectTierRate(
  monthlyGross: number,
  tiers: {
    t1Threshold: number;
    t1Rate: number;
    t2Threshold: number;
    t2Rate: number;
    t3Rate: number;
  },
): number {
  if (monthlyGross < tiers.t1Threshold) return tiers.t1Rate;
  if (monthlyGross < tiers.t2Threshold) return tiers.t2Rate;
  return tiers.t3Rate;
}

/**
 * 指定月のイベント別 R/S を再計算して revenue_shares に保存する。
 * 集計は年月単位の使い捨て。実行ごとに既存レコードを全削除してから
 * 指定月の集計結果のみを保存する（履歴は持たない）。
 */
export async function computeRevenueSharesForPeriod(period: string) {
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

  // 階段制のしきい値・率は AppSetting から取得
  const [
    paymentFeeRate,
    t1Threshold,
    t1Rate,
    t2Threshold,
    t2Rate,
    t3Rate,
  ] = await Promise.all([
    getSettingFloat("paymentFeeRate"),
    getSettingInt("rsTier1Threshold"),
    getSettingFloat("rsTier1Rate"),
    getSettingInt("rsTier2Threshold"),
    getSettingFloat("rsTier2Rate"),
    getSettingFloat("rsTier3Rate"),
  ]);

  const monthlyGross = rows.reduce(
    (s, r) => s + Number(r.gross ?? 0),
    0,
  );

  const ourShareRate = selectTierRate(monthlyGross, {
    t1Threshold,
    t1Rate,
    t2Threshold,
    t2Rate,
    t3Rate,
  });

  return await prisma.$transaction(async (tx) => {
    // 履歴は持たず、毎回まっさらにしてから当月分だけ書き直す
    await tx.revenueShare.deleteMany({});

    const created = [];
    for (const r of rows) {
      const grossSales = Number(r.gross ?? 0);
      // 決済手数料 = グロス × paymentFeeRate（円未満切り上げで弊社に過小計上しない）
      const paymentFee = Math.ceil(grossSales * paymentFeeRate);
      // 手数料控除後の対象額に対して弊社取り分率を掛ける
      const netForShare = Math.max(0, grossSales - paymentFee);
      const ourAmount = Math.round(netForShare * ourShareRate);
      const aveliaAmount = netForShare - ourAmount;

      created.push(
        await tx.revenueShare.create({
          data: {
            eventId: r.eventId,
            period,
            grossSales,
            paymentFee,
            shippingFee: Number(r.shipping ?? 0),
            refunds: 0,
            externalCost: 0,
            ourShareRate,
            ourAmount,
            aveliaAmount,
            conditions: {
              ourShareRate,
              paymentFeeRate,
              tiers: {
                t1Threshold,
                t1Rate,
                t2Threshold,
                t2Rate,
                t3Rate,
              },
              monthlyGross,
              note: "自動集計（階段制 R/S + 決済手数料控除済み）",
            },
          },
        }),
      );
    }
    return created;
  });
}
