/**
 * アベリアくじ動作確認用のデモデータを作る。
 *
 * 4 種類のテスト用キャンペーンを生成する:
 *   1. 標準型: ¥770 / 1・10・50・100 連 / 6 段階の賞
 *   2. お手軽ミニくじ: ¥330 / 1・5・20 連 / 4 段階の賞
 *   3. プレミアムくじ: ¥1500 / 1・3・10 連 / 8 段階の賞（高単価・狭き門）
 *   4. ライブ記念くじ（終了済み）: ¥500 / 1・10・30 連 / 5 段階の賞
 *
 * 各くじで S/A の上位賞は本数制 (LIMITED)、それ以下は確率制 (PROBABILITY)。
 * 連数オマケ専用賞も用意し、複数連の SKU に紐付ける。
 *
 * 実行: npx tsx scripts/seed-avelia-kuji-demo.ts
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

type PrizeSeed = {
  rank: string;
  name: string;
  variantNote?: string;
  imageLock: number;
  imageKeyword: string;
} & (
  | { type: "LIMITED"; totalCount: number }
  | { type: "PROBABILITY"; weight: number }
  | { type: "BUNDLE_ONLY" }
);

type BundleSeed = {
  drawCount: number;
  priceTotal: number;
  bonusRank?: string;
};

type CampaignSeed = {
  title: string;
  description: string;
  bannerLock: number;
  bannerKeyword: string;
  pricePerDraw: number;
  deliveryNote: string;
  saleOffsetDaysFromNow: { start: number; end: number };
  status: "OPEN" | "CLOSED";
  notes: string;
  prizes: PrizeSeed[];
  bundles: BundleSeed[];
};

const CAMPAIGNS: CampaignSeed[] = [
  {
    title: "【テスト】推しオフショット スペシャルアベリアくじ",
    description:
      "限定オフショット写真・グッズが当たるオンラインガチャです。\nハズレなし、必ず何かが当たります。",
    bannerLock: 51001,
    bannerKeyword: "concert",
    pricePerDraw: 770,
    deliveryNote: "2026年9月下旬",
    saleOffsetDaysFromNow: { start: -1, end: 14 },
    status: "OPEN",
    notes:
      "・購入後のキャンセル・返品はお受けできません。\n・転売は禁止です。\n・確率は常に100%に調整されています。",
    prizes: [
      { rank: "S", name: "直筆サイン入りA2ポスター", variantNote: "1種", imageLock: 51010, imageKeyword: "poster", type: "LIMITED", totalCount: 3 },
      { rank: "A", name: "アクリルパネル", variantNote: "8種", imageLock: 51011, imageKeyword: "design", type: "LIMITED", totalCount: 10 },
      { rank: "B", name: "チェキファイル", variantNote: "7種", imageLock: 51012, imageKeyword: "folder", type: "PROBABILITY", weight: 500 },
      { rank: "C", name: "アクスタ", variantNote: "7種", imageLock: 51013, imageKeyword: "art", type: "PROBABILITY", weight: 1500 },
      { rank: "D", name: "缶バッジ", variantNote: "14種", imageLock: 51014, imageKeyword: "badge", type: "PROBABILITY", weight: 3000 },
      { rank: "E", name: "フォトカード", variantNote: "16種", imageLock: 51015, imageKeyword: "card", type: "PROBABILITY", weight: 5000 },
      { rank: "10連", name: "10連限定 オリジナルクリアファイル", variantNote: "10連購入特典", imageLock: 51020, imageKeyword: "folder", type: "BUNDLE_ONLY" },
      { rank: "100連", name: "100連限定 スペシャルBOXセット", variantNote: "100連購入特典", imageLock: 51021, imageKeyword: "box", type: "BUNDLE_ONLY" },
    ],
    bundles: [
      { drawCount: 1, priceTotal: 770 },
      { drawCount: 10, priceTotal: 7700, bonusRank: "10連" },
      { drawCount: 50, priceTotal: 38500 },
      { drawCount: 100, priceTotal: 77000, bonusRank: "100連" },
    ],
  },
  {
    title: "【テスト】サイン色紙 ミニくじ",
    description:
      "1回 ¥330 で気軽に引けるミニくじ。直筆サイン色紙が当たるチャンスあり。",
    bannerLock: 52001,
    bannerKeyword: "stage",
    pricePerDraw: 330,
    deliveryNote: "2026年8月下旬",
    saleOffsetDaysFromNow: { start: -2, end: 21 },
    status: "OPEN",
    notes:
      "・お一人様何回でも引けます。\n・購入後のキャンセル・返品はお受けできません。\n・確率は常に100%に調整されています。",
    prizes: [
      { rank: "S", name: "直筆サイン色紙", variantNote: "1種", imageLock: 52010, imageKeyword: "art", type: "LIMITED", totalCount: 5 },
      { rank: "A", name: "アクスタキーホルダー", variantNote: "5種", imageLock: 52011, imageKeyword: "keychain", type: "LIMITED", totalCount: 20 },
      { rank: "B", name: "ステッカーセット", variantNote: "10種", imageLock: 52012, imageKeyword: "sticker", type: "PROBABILITY", weight: 3000 },
      { rank: "C", name: "フォトカード", variantNote: "12種", imageLock: 52013, imageKeyword: "card", type: "PROBABILITY", weight: 7000 },
      { rank: "20連", name: "20連限定 サイン入りミニカード", variantNote: "20連購入特典", imageLock: 52020, imageKeyword: "card", type: "BUNDLE_ONLY" },
    ],
    bundles: [
      { drawCount: 1, priceTotal: 330 },
      { drawCount: 5, priceTotal: 1650 },
      { drawCount: 20, priceTotal: 6600, bonusRank: "20連" },
    ],
  },
  {
    title: "【テスト】豪華フォトブック プレミアムアベリアくじ",
    description:
      "限定フォトブックや直筆チェキが狙える高単価プレミアムくじ。\nS賞・A賞は本数限定、絶対欲しい人は連数で勝負！",
    bannerLock: 53001,
    bannerKeyword: "neon",
    pricePerDraw: 1500,
    deliveryNote: "2026年11月下旬",
    saleOffsetDaysFromNow: { start: 0, end: 10 },
    status: "OPEN",
    notes:
      "・購入後のキャンセル・返品はお受けできません。\n・S/A/B 賞は本数限定です。\n・転売は禁止です。",
    prizes: [
      { rank: "S", name: "直筆サイン入り限定フォトブック", variantNote: "1種", imageLock: 53010, imageKeyword: "book", type: "LIMITED", totalCount: 2 },
      { rank: "A", name: "直筆サイン入りチェキ", variantNote: "3種", imageLock: 53011, imageKeyword: "photo", type: "LIMITED", totalCount: 5 },
      { rank: "B", name: "アクリルスタンド大", variantNote: "5種", imageLock: 53012, imageKeyword: "design", type: "LIMITED", totalCount: 10 },
      { rank: "C", name: "ジオラマフィギュア", variantNote: "5種", imageLock: 53013, imageKeyword: "figure", type: "PROBABILITY", weight: 800 },
      { rank: "D", name: "ハンドタオル", variantNote: "5種", imageLock: 53014, imageKeyword: "towel", type: "PROBABILITY", weight: 2000 },
      { rank: "E", name: "アクリルキーホルダー", variantNote: "10種", imageLock: 53015, imageKeyword: "keychain", type: "PROBABILITY", weight: 2500 },
      { rank: "F", name: "ステッカーセット", variantNote: "10種", imageLock: 53016, imageKeyword: "sticker", type: "PROBABILITY", weight: 2200 },
      { rank: "G", name: "フォトカード", variantNote: "20種", imageLock: 53017, imageKeyword: "card", type: "PROBABILITY", weight: 2500 },
      { rank: "10連", name: "10連限定 ラバーストラップセット", variantNote: "10連購入特典", imageLock: 53020, imageKeyword: "strap", type: "BUNDLE_ONLY" },
    ],
    bundles: [
      { drawCount: 1, priceTotal: 1500 },
      { drawCount: 3, priceTotal: 4500 },
      { drawCount: 10, priceTotal: 15000, bonusRank: "10連" },
    ],
  },
  {
    title: "【テスト】ライブ記念くじ（販売終了）",
    description:
      "ライブ開催を記念した過去のアベリアくじです。販売は終了しています。",
    bannerLock: 54001,
    bannerKeyword: "festival",
    pricePerDraw: 500,
    deliveryNote: "2026年5月下旬（発送済）",
    saleOffsetDaysFromNow: { start: -45, end: -7 },
    status: "CLOSED",
    notes:
      "・このくじは販売を終了しました。\n・新規の購入はできません。",
    prizes: [
      { rank: "S", name: "ライブ会場限定 ポラロイド", variantNote: "1種", imageLock: 54010, imageKeyword: "photo", type: "LIMITED", totalCount: 1 },
      { rank: "A", name: "限定ツアーTシャツ", variantNote: "3サイズ", imageLock: 54011, imageKeyword: "tshirt", type: "LIMITED", totalCount: 5 },
      { rank: "B", name: "ライブロゴタオル", variantNote: "1種", imageLock: 54012, imageKeyword: "towel", type: "PROBABILITY", weight: 1500 },
      { rank: "C", name: "缶バッジセット", variantNote: "8種", imageLock: 54013, imageKeyword: "badge", type: "PROBABILITY", weight: 3500 },
      { rank: "D", name: "ライブフォトカード", variantNote: "12種", imageLock: 54014, imageKeyword: "card", type: "PROBABILITY", weight: 5000 },
      { rank: "30連", name: "30連限定 ライブメモリアルブック", variantNote: "30連購入特典", imageLock: 54020, imageKeyword: "book", type: "BUNDLE_ONLY" },
    ],
    bundles: [
      { drawCount: 1, priceTotal: 500 },
      { drawCount: 10, priceTotal: 5000 },
      { drawCount: 30, priceTotal: 15000, bonusRank: "30連" },
    ],
  },
];

async function createCampaign(
  seed: CampaignSeed,
  artistId: string | null,
  eventId: string | null,
) {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const saleStartAt = new Date(now.getTime() + seed.saleOffsetDaysFromNow.start * day);
  const saleEndAt = new Date(now.getTime() + seed.saleOffsetDaysFromNow.end * day);

  const campaign = await prisma.kujiCampaign.create({
    data: {
      title: seed.title,
      description: seed.description,
      bannerImageUrl: `https://loremflickr.com/1200/675/${seed.bannerKeyword}?lock=${seed.bannerLock}`,
      eventId,
      artistId,
      saleStartAt,
      saleEndAt,
      pricePerDraw: seed.pricePerDraw,
      deliveryNote: seed.deliveryNote,
      notesText: seed.notes,
      status: seed.status,
    },
  });
  console.log(`  ✓ くじ作成: ${campaign.title}`);

  // 賞作成
  const createdPrizes: Record<string, string> = {}; // rank -> prizeId
  for (let i = 0; i < seed.prizes.length; i++) {
    const p = seed.prizes[i];
    const data: Prisma.KujiPrizeCreateInput = {
      campaign: { connect: { id: campaign.id } },
      rank: p.rank,
      order: i,
      name: p.name,
      imageUrl: `https://loremflickr.com/600/600/${p.imageKeyword}?lock=${p.imageLock}`,
      variantNote: p.variantNote ?? null,
      type: p.type === "BUNDLE_ONLY" ? "PROBABILITY" : p.type,
      totalCount: p.type === "LIMITED" ? p.totalCount : null,
      remainingCount: p.type === "LIMITED" ? p.totalCount : null,
      probabilityWeight:
        p.type === "PROBABILITY"
          ? p.weight
          : p.type === "BUNDLE_ONLY"
            ? 0
            : null,
      bundleOnly: p.type === "BUNDLE_ONLY",
    };
    const created = await prisma.kujiPrize.create({ data });
    createdPrizes[p.rank] = created.id;
  }
  console.log(`    賞 ${seed.prizes.length} 件`);

  // 連数SKU 作成（SKU は global unique なので campaign.id 全体 + drawCount で衝突回避）
  for (const b of seed.bundles) {
    await prisma.kujiBundle.create({
      data: {
        campaignId: campaign.id,
        drawCount: b.drawCount,
        priceTotal: b.priceTotal,
        bonusPrizeId: b.bonusRank ? createdPrizes[b.bonusRank] ?? null : null,
        sku: `KUJI-${campaign.id}-${b.drawCount}`,
      },
    });
  }
  console.log(`    連数SKU ${seed.bundles.length} 件`);

  return campaign;
}

async function main() {
  // 既存テスト用くじを掃除（タイトル前方一致）
  const existing = await prisma.kujiCampaign.findMany({
    where: { title: { startsWith: "【テスト】" } },
    select: {
      id: true,
      title: true,
      _count: { select: { draws: true } },
    },
  });
  let deleted = 0;
  for (const c of existing) {
    if (c._count.draws === 0) {
      await prisma.kujiCampaign.delete({ where: { id: c.id } });
      deleted += 1;
    }
  }
  console.log(`# 既存テスト用くじ: ${existing.length} 件 / 削除: ${deleted} 件`);

  const artist = await prisma.artist.findFirst();
  const event = await prisma.event.findFirst();

  for (const seed of CAMPAIGNS) {
    await createCampaign(seed, artist?.id ?? null, event?.id ?? null);
  }

  console.log(`\n✅ 合計 ${CAMPAIGNS.length} 件のテストくじを作成しました`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
