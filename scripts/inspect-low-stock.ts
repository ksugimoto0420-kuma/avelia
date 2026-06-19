import { prisma } from "../src/lib/prisma";

async function main() {
  type Row = {
    variantId: string;
    variantName: string;
    productName: string;
    eventTitle: string;
    quantity: number;
    reserved: number;
    sold: number;
    available: number;
    lowStockThreshold: number | null;
  };
  // 閾値設定済みのインベントリと、各バリアントの状況
  const withThreshold = await prisma.$queryRaw<Row[]>`
    SELECT pv.id AS "variantId", pv.name AS "variantName",
           p.name AS "productName", e.title AS "eventTitle",
           i.quantity, i.reserved, i.sold,
           (i.quantity - i.reserved - i.sold) AS available,
           i."lowStockThreshold" AS "lowStockThreshold"
    FROM inventories i
    JOIN product_variants pv ON pv.id = i."variantId"
    JOIN products p ON p.id = pv."productId"
    JOIN events e ON e.id = p."eventId"
    WHERE i."lowStockThreshold" IS NOT NULL
    ORDER BY (i.quantity - i.reserved - i.sold) ASC
    LIMIT 20
  `;
  console.log(`閾値設定済み: ${withThreshold.length} 件`);
  for (const r of withThreshold) {
    console.log(
      `  available=${r.available} (threshold=${r.lowStockThreshold}) ${r.eventTitle} / ${r.productName} / ${r.variantName}`,
    );
  }

  const noThreshold = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM inventories WHERE "lowStockThreshold" IS NULL
  `;
  console.log(`閾値未設定: ${noThreshold[0]?.count ?? 0n} 件`);

  // 低在庫として判定されるもの
  const lowRows = await prisma.$queryRaw<Row[]>`
    SELECT pv.id AS "variantId", pv.name AS "variantName",
           p.name AS "productName", e.title AS "eventTitle",
           i.quantity, i.reserved, i.sold,
           (i.quantity - i.reserved - i.sold) AS available,
           i."lowStockThreshold" AS "lowStockThreshold"
    FROM inventories i
    JOIN product_variants pv ON pv.id = i."variantId"
    JOIN products p ON p.id = pv."productId"
    JOIN events e ON e.id = p."eventId"
    WHERE i."lowStockThreshold" IS NOT NULL
      AND (i.quantity - i.reserved - i.sold) <= i."lowStockThreshold"
      AND p."isPublished" = true
      AND e."isPublished" = true
    ORDER BY (i.quantity - i.reserved - i.sold) ASC
  `;
  console.log(`\n現在の低在庫: ${lowRows.length} 件`);
  for (const r of lowRows) {
    console.log(
      `  available=${r.available} threshold=${r.lowStockThreshold} ${r.eventTitle} / ${r.productName} / ${r.variantName}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
