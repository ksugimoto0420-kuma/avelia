/**
 * デモ前チェック: 主要なデータと機能の状態を一括確認する。
 * 本番Neonに対して読取のみ実行。
 */
import { prisma } from "../src/lib/prisma";

function ok(b: boolean): string {
  return b ? "✅" : "❌";
}

async function main() {
  console.log("=".repeat(60));
  console.log("デモ前チェック");
  console.log("=".repeat(60));

  // 1) ダッシュボードの低在庫アラート
  console.log("\n## 1) ダッシュボードに低在庫アラートが出ているか");
  const lowStock = await prisma.$queryRaw<
    Array<{
      variantName: string;
      productName: string;
      eventTitle: string;
      available: number;
      threshold: number;
    }>
  >`
    SELECT pv.name AS "variantName", p.name AS "productName",
           e.title AS "eventTitle",
           (i.quantity - i.reserved - i.sold)::int AS available,
           i."lowStockThreshold"::int AS threshold
    FROM inventories i
    JOIN product_variants pv ON pv.id = i."variantId"
    JOIN products p ON p.id = pv."productId"
    JOIN events e ON e.id = p."eventId"
    WHERE i."lowStockThreshold" IS NOT NULL
      AND (i.quantity - i.reserved - i.sold) <= i."lowStockThreshold"
      AND p."isPublished" = true
      AND e."isPublished" = true
      AND (e."saleEndAt" IS NULL OR e."saleEndAt" >= NOW())
    ORDER BY (i.quantity - i.reserved - i.sold) ASC, p.name ASC
  `;
  console.log(`  ${ok(lowStock.length > 0)} 表示件数: ${lowStock.length}`);
  for (const r of lowStock) {
    console.log(
      `    - ${r.productName} (${r.variantName}) [残${r.available}/閾値${r.threshold}] ${r.eventTitle}`,
    );
  }

  // 2) 抽選デモ
  console.log("\n## 2) 抽選デモ（締切・実行可能）が抽選実行可能か");
  const lotteryDemos = await prisma.lottery.findMany({
    where: { title: { startsWith: "抽選デモ" } },
    include: { _count: { select: { entries: true } } },
  });
  for (const l of lotteryDemos) {
    const now = new Date();
    const isDraft = l.status === "DRAFT";
    const isOpen = l.status === "OPEN";
    const isClosed = l.status === "CLOSED";
    const isDrawn = l.status === "DRAWN";
    const beforeDeadline = now < l.entryEndAt;
    const hasEntries = l._count.entries > 0;
    const executable =
      !isDraft && !isDrawn && !beforeDeadline && hasEntries;
    console.log(
      `  - "${l.title}" status=${l.status} entries=${l._count.entries} entryEnd=${l.entryEndAt.toISOString().slice(0, 16)}`,
    );
    if (l.title.includes("締切")) {
      console.log(`    ${ok(executable)} 実行可能判定: ${executable}`);
      if (!executable) {
        if (isDraft) console.log("       理由: DRAFT");
        else if (isDrawn) console.log("       理由: 既に抽選済み");
        else if (beforeDeadline) console.log("       理由: 締切前");
        else if (!hasEntries) console.log("       理由: 応募者なし");
      }
    }
    if (l.title.includes("受付中")) {
      console.log(
        `    ${ok(isOpen && beforeDeadline)} 受付中状態: status=${l.status} 締切前=${beforeDeadline}`,
      );
    }
    if (l.title.includes("下書き")) {
      console.log(`    ${ok(isDraft)} 下書き状態: ${isDraft}`);
    }
    void isClosed;
  }

  // 3) STAR PRISM のメンバー注文数
  console.log("\n## 3) 制作リストの STAR PRISM 選択時にメンバーピルが並ぶか");
  const event = await prisma.event.findFirst({
    where: { title: { contains: "STAR PRISM オフィシャルグッズ" } },
    include: {
      products: { include: { variants: { select: { id: true, name: true } } } },
    },
  });
  if (!event) {
    console.log(`  ❌ STAR PRISM イベントが見つかりません`);
  } else {
    const memberNames = new Set<string>();
    for (const p of event.products)
      for (const v of p.variants) memberNames.add(v.name);
    console.log(
      `  ${ok(memberNames.size > 0)} バリアント数（ピル数）: ${memberNames.size}`,
    );
    console.log(`     ${Array.from(memberNames).join(" / ")}`);

    // 各バリアントの注文数（メンバー絞り込み時に何件出るか）
    const counts = await prisma.$queryRaw<
      Array<{ variantName: string; cnt: number }>
    >`
      SELECT pv.name AS "variantName", COUNT(*)::int AS cnt
      FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      JOIN product_variants pv ON pv.id = oi."variantId"
      JOIN products p ON p.id = pv."productId"
      WHERE o.status = 'PAID' AND p."eventId" = ${event.id}
      GROUP BY pv.name
      ORDER BY pv.name
    `;
    console.log(`  メンバー別の制作リスト行数（数量展開前）:`);
    for (const c of counts)
      console.log(
        `    - ${c.variantName}: ${c.cnt} 件 ${c.cnt >= 1 ? "✅" : "❌"}`,
      );
  }

  // 4) 発送リストプレビュー対象件数
  console.log("\n## 4) 発送リスト プレビュー対象件数");
  const shipAll = await prisma.order.count({
    where: {
      status: "PAID",
      items: {
        some: { variant: { product: { type: "PHYSICAL" } } },
      },
    },
  });
  const shipInHouse = await prisma.order.count({
    where: {
      status: "PAID",
      items: {
        some: {
          variant: {
            product: { type: "PHYSICAL", fulfillmentSource: "IN_HOUSE" },
          },
        },
      },
    },
  });
  const shipWarehouse = await prisma.order.count({
    where: {
      status: "PAID",
      items: {
        some: {
          variant: {
            product: { type: "PHYSICAL", fulfillmentSource: "WAREHOUSE" },
          },
        },
      },
    },
  });
  console.log(`  ${ok(shipAll > 0)} すべて: ${shipAll} 件`);
  console.log(`  ${ok(shipInHouse > 0)} 手元出荷: ${shipInHouse} 件`);
  console.log(`  ${ok(shipWarehouse > 0)} 倉庫出荷: ${shipWarehouse} 件`);

  // 5) 注文管理のステータスバリエーション
  console.log("\n## 5) 注文管理のステータスバリエーション");
  const orderCounts = await prisma.order.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  for (const c of orderCounts)
    console.log(`  - ${c.status}: ${c._count._all} 件`);

  // 6) 決済管理のステータスバリエーション
  console.log("\n## 6) 決済管理のステータスバリエーション");
  const payCounts = await prisma.payment.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  for (const c of payCounts)
    console.log(`  - ${c.status}: ${c._count._all} 件`);

  // 7) デジタルコンテンツの種別
  console.log("\n## 7) デジタルコンテンツの種別バリエーション");
  const dcCounts = await prisma.digitalContent.groupBy({
    by: ["type"],
    _count: { _all: true },
  });
  for (const c of dcCounts)
    console.log(`  - ${c.type}: ${c._count._all} 件`);

  // 8) サイン納品（制作待ち / 納品済）
  console.log("\n## 8) サイン納品");
  const ddCounts = await prisma.digitalDelivery.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  for (const c of ddCounts)
    console.log(`  - ${c.status}: ${c._count._all} 件`);

  // 9) シードユーザー存在チェック
  console.log("\n## 9) ログインアカウント存在チェック");
  const user = await prisma.user.findUnique({
    where: { email: "user@example.com" },
    select: { id: true },
  });
  console.log(`  ${ok(!!user)} user@example.com`);
  const admin = await prisma.adminUser.findUnique({
    where: { email: "admin@example.com" },
    select: { id: true, isActive: true },
  });
  console.log(
    `  ${ok(!!admin && admin.isActive)} admin@example.com (active=${admin?.isActive})`,
  );

  // 10) サイト設定
  console.log("\n## 10) サイト設定（送料・サポート）");
  const settings = await prisma.appSetting.findMany({
    where: {
      key: {
        in: [
          "shippingFlatRate",
          "shippingFreeThreshold",
          "supportEmail",
          "siteName",
        ],
      },
    },
  });
  for (const s of settings) console.log(`  - ${s.key} = ${s.value}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ チェック完了");
  console.log("=".repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
