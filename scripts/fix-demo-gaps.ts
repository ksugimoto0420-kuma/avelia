/**
 * デモ前ギャップ対応:
 * 1) 「倉庫出荷」発送リストが 0 件にならないように、既存の物販商品
 *    （写真集系・カードパック系など重量物っぽいもの）の一部を
 *    fulfillmentSource = WAREHOUSE に変更する。
 * 2) サイト設定が空っぽだったので、デモ用のデフォルト値を投入する。
 *    （ヤマトB2形式 CSV の「ご依頼主」欄もここから補完される）
 */
import { prisma } from "../src/lib/prisma";

async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

async function main() {
  // ============================================================
  // 1) 倉庫出荷の対象商品を作る
  // ============================================================
  console.log("# 物販商品の発送元を WAREHOUSE に切替");
  const targetNamePatterns = ["写真集", "カードパック", "コンプリート"];
  const targets = await prisma.product.findMany({
    where: {
      type: "PHYSICAL",
      fulfillmentSource: "IN_HOUSE",
      OR: targetNamePatterns.map((kw) => ({ name: { contains: kw } })),
      // PAID 注文が紐づいている商品だけ対象（CSV 出力でちゃんと出る）
      variants: {
        some: { orderItems: { some: { order: { status: "PAID" } } } },
      },
    },
    select: { id: true, name: true },
    take: 20,
  });
  console.log(`  対象候補: ${targets.length} 件`);
  for (const t of targets) {
    await prisma.product.update({
      where: { id: t.id },
      data: { fulfillmentSource: "WAREHOUSE" },
    });
    console.log(`  ✓ ${t.name}`);
  }

  // 念のため対象ゼロのときは、PAID 注文が多い物販を上から3件強制的に倉庫扱いに
  if (targets.length === 0) {
    const fallback = await prisma.product.findMany({
      where: { type: "PHYSICAL", fulfillmentSource: "IN_HOUSE" },
      take: 3,
      select: { id: true, name: true },
    });
    for (const f of fallback) {
      await prisma.product.update({
        where: { id: f.id },
        data: { fulfillmentSource: "WAREHOUSE" },
      });
      console.log(`  (fallback) ✓ ${f.name}`);
    }
  }

  // 結果確認
  const warehouseCount = await prisma.order.count({
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
  console.log(`  → 倉庫出荷 PAID 注文: ${warehouseCount} 件`);

  // ============================================================
  // 2) サイト設定 投入
  // ============================================================
  console.log("\n# サイト設定 投入");
  await setSetting("shippingFlatRate", "500");
  await setSetting("shippingFreeThreshold", "5000");
  await setSetting("supportEmail", "support@avelia-funclub.example.com");
  await setSetting("siteName", "Avelia FunClub");
  console.log("  ✓ shippingFlatRate / shippingFreeThreshold / supportEmail / siteName");

  // 結果確認
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
  for (const s of settings) console.log(`  ${s.key} = ${s.value}`);

  console.log("\n✅ done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
