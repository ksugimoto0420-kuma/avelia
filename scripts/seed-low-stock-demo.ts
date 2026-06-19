/**
 * デモ用に、いくつかのバリアントに低在庫閾値 (lowStockThreshold) を設定して
 * ダッシュボードに低在庫アラートが見える状態にする。
 *
 * 既存在庫の残数(=available)を見て、それを上回る閾値を入れる。
 * 例: available=3 → threshold=10 に設定して「閾値以下」状態を作る。
 *
 * 冪等: 既に閾値が設定されている in inventories は触らない。
 *       環境変数 FORCE=1 を指定したら上書き。
 */
import { prisma } from "../src/lib/prisma";

type Row = {
  variantId: string;
  variantName: string;
  productName: string;
  eventTitle: string;
  available: number;
  current: number | null;
};

async function main() {
  const force = process.env.FORCE === "1";

  // 残在庫が少ない順に 8 件ピック（公開中の Event/Product のみ）
  const candidates = await prisma.$queryRaw<Row[]>`
    SELECT pv.id AS "variantId", pv.name AS "variantName",
           p.name AS "productName", e.title AS "eventTitle",
           (i.quantity - i.reserved - i.sold)::int AS available,
           i."lowStockThreshold" AS current
    FROM inventories i
    JOIN product_variants pv ON pv.id = i."variantId"
    JOIN products p ON p.id = pv."productId"
    JOIN events e ON e.id = p."eventId"
    WHERE p."isPublished" = true
      AND e."isPublished" = true
      AND (i.quantity - i.reserved - i.sold) > 0
    ORDER BY (i.quantity - i.reserved - i.sold) ASC, p.name ASC
    LIMIT 8
  `;
  console.log(`候補: ${candidates.length} 件`);

  let updated = 0;
  for (const r of candidates) {
    if (r.current != null && !force) {
      console.log(
        `  [skip] ${r.eventTitle} / ${r.productName} / ${r.variantName} (current=${r.current})`,
      );
      continue;
    }
    // 残数の 2 倍以上＋余裕、最低 10 をセット
    const threshold = Math.max(10, r.available * 2 + 5);
    await prisma.inventory.update({
      where: { variantId: r.variantId },
      data: { lowStockThreshold: threshold, lowStockAlertedAt: null },
    });
    console.log(
      `  [ok] ${r.eventTitle} / ${r.productName} / ${r.variantName} : available=${r.available} → threshold=${threshold}`,
    );
    updated++;
  }
  console.log(`✅ updated=${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
