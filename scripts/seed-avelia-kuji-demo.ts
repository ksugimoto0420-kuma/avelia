/**
 * アベリアくじ動作確認用のデモデータを作る。
 *
 * - くじ 1〜2件
 * - 各くじに S/A/B/C/D/E の6段階の賞
 * - 連数SKU 1/10/50/100
 * - S/A は本数制（LIMITED）、B〜E は確率制（PROBABILITY）
 * - 10連オマケ・100連オマケに専用賞を割り当て
 *
 * 実行: npx tsx scripts/seed-avelia-kuji-demo.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  // 既存テスト用くじを掃除（タイトル前方一致）
  const existing = await prisma.kujiCampaign.findMany({
    where: { title: { startsWith: "【テスト】" } },
    select: { id: true, _count: { select: { draws: true } } },
  });
  for (const c of existing) {
    if (c._count.draws === 0) {
      await prisma.kujiCampaign.delete({ where: { id: c.id } });
    }
  }
  console.log(
    `# 既存テスト用くじ: ${existing.length} 件 / 削除可能: ${existing.filter((c) => c._count.draws === 0).length} 件`,
  );

  const artist = await prisma.artist.findFirst();
  const event = await prisma.event.findFirst();

  const now = new Date();
  const saleStartAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 昨日
  const saleEndAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2週間後

  const campaign = await prisma.kujiCampaign.create({
    data: {
      title: "【テスト】推しオフショット スペシャルアベリアくじ",
      description:
        "限定オフショット写真・グッズが当たるオンラインガチャです。\nハズレなし、必ず何かが当たります。",
      bannerImageUrl: "https://loremflickr.com/1200/675/concert?lock=51001",
      eventId: event?.id ?? null,
      artistId: artist?.id ?? null,
      saleStartAt,
      saleEndAt,
      pricePerDraw: 770,
      deliveryNote: "2026年9月下旬",
      notesText:
        "・購入後のキャンセル・返品はお受けできません。\n・転売は禁止です。\n・確率は常に100%に調整されています。",
      status: "OPEN",
    },
  });
  console.log(`✓ くじ作成: ${campaign.title} (id=${campaign.id})`);

  // 賞
  const prizes = await Promise.all([
    prisma.kujiPrize.create({
      data: {
        campaignId: campaign.id,
        rank: "S",
        order: 1,
        name: "直筆サイン入りA2ポスター",
        imageUrl: "https://loremflickr.com/600/600/poster?lock=51010",
        variantNote: "1種",
        type: "LIMITED",
        totalCount: 3,
        remainingCount: 3,
      },
    }),
    prisma.kujiPrize.create({
      data: {
        campaignId: campaign.id,
        rank: "A",
        order: 2,
        name: "アクリルパネル",
        imageUrl: "https://loremflickr.com/600/600/design?lock=51011",
        variantNote: "8種",
        type: "LIMITED",
        totalCount: 10,
        remainingCount: 10,
      },
    }),
    prisma.kujiPrize.create({
      data: {
        campaignId: campaign.id,
        rank: "B",
        order: 3,
        name: "チェキファイル",
        imageUrl: "https://loremflickr.com/600/600/folder?lock=51012",
        variantNote: "7種",
        type: "PROBABILITY",
        probabilityWeight: 500, // 5%
      },
    }),
    prisma.kujiPrize.create({
      data: {
        campaignId: campaign.id,
        rank: "C",
        order: 4,
        name: "アクスタ",
        imageUrl: "https://loremflickr.com/600/600/art?lock=51013",
        variantNote: "7種",
        type: "PROBABILITY",
        probabilityWeight: 1500, // 15%
      },
    }),
    prisma.kujiPrize.create({
      data: {
        campaignId: campaign.id,
        rank: "D",
        order: 5,
        name: "缶バッジ",
        imageUrl: "https://loremflickr.com/600/600/badge?lock=51014",
        variantNote: "14種",
        type: "PROBABILITY",
        probabilityWeight: 3000, // 30%
      },
    }),
    prisma.kujiPrize.create({
      data: {
        campaignId: campaign.id,
        rank: "E",
        order: 6,
        name: "フォトカード",
        imageUrl: "https://loremflickr.com/600/600/card?lock=51015",
        variantNote: "16種",
        type: "PROBABILITY",
        probabilityWeight: 5000, // 50%
      },
    }),
    // 連数オマケ専用
    prisma.kujiPrize.create({
      data: {
        campaignId: campaign.id,
        rank: "10連",
        order: 90,
        name: "10連限定 オリジナルクリアファイル",
        imageUrl: "https://loremflickr.com/600/600/folder?lock=51020",
        variantNote: "10連購入特典",
        type: "PROBABILITY",
        probabilityWeight: 0,
        bundleOnly: true,
      },
    }),
    prisma.kujiPrize.create({
      data: {
        campaignId: campaign.id,
        rank: "100連",
        order: 91,
        name: "100連限定 スペシャルBOXセット",
        imageUrl: "https://loremflickr.com/600/600/box?lock=51021",
        variantNote: "100連購入特典",
        type: "PROBABILITY",
        probabilityWeight: 0,
        bundleOnly: true,
      },
    }),
  ]);
  console.log(`✓ 賞 ${prizes.length} 件作成`);

  const bonus10 = prizes.find((p) => p.rank === "10連");
  const bonus100 = prizes.find((p) => p.rank === "100連");

  // 連数SKU
  await prisma.kujiBundle.createMany({
    data: [
      {
        campaignId: campaign.id,
        drawCount: 1,
        priceTotal: 770,
        sku: `KUJI-${campaign.id.slice(0, 6)}-1`,
      },
      {
        campaignId: campaign.id,
        drawCount: 10,
        priceTotal: 7700,
        bonusPrizeId: bonus10?.id ?? null,
        sku: `KUJI-${campaign.id.slice(0, 6)}-10`,
      },
      {
        campaignId: campaign.id,
        drawCount: 50,
        priceTotal: 38500,
        sku: `KUJI-${campaign.id.slice(0, 6)}-50`,
      },
      {
        campaignId: campaign.id,
        drawCount: 100,
        priceTotal: 77000,
        bonusPrizeId: bonus100?.id ?? null,
        sku: `KUJI-${campaign.id.slice(0, 6)}-100`,
      },
    ],
  });
  console.log("✓ 連数SKU 4件作成");

  console.log("\n✅ done");
  console.log(`\n管理: /admin/kuji/${campaign.id}`);
  console.log(`ユーザー: /kuji/${campaign.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
