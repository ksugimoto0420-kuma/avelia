import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// 再現性のある擬似乱数（mulberry32）
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260605);
const rand = () => rng();
const int = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const chance = (p: number) => rng() < p;
const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const DAY = 24 * 60 * 60 * 1000;
const fromNow = (days: number, hours = 0) =>
  new Date(Date.now() + days * DAY + hours * 60 * 60 * 1000);

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

// ---------------------------------------------------------------------------
// データプール（架空のアイドル / グループ名）
// ---------------------------------------------------------------------------
const GROUPS = [
  "KIRARI LAB.",
  "Sweet Bloom",
  "Tokyo Neon",
  "Lumière",
  "STAR PRISM",
  "Candy Pop",
  "Pastel Wave",
  "Sakura Gumi",
  "Melody Box",
  "Aoi Sora",
  "HONEY MOON",
  "Prism Drops",
  "Cherry Parade",
  "Nebula Girls",
  "Sugar Rush",
  "Mirage Tokyo",
  "Lovely Comet",
  "Bloom Bloom",
  "Twinkle Note",
  "Velvet Sky",
];

const MEMBERS = [
  "星野ひなた", "桜井みれい", "夏木あおい", "月城ルナ", "白石こはく",
  "天王寺さくら", "藤宮ねね", "葉山みお", "如月りん", "早瀬ノエル",
  "美山かれん", "一ノ瀬みか", "森田あみ", "櫻井優衣", "月足天音",
  "高峰すず", "東雲はる", "音宮もも", "綾瀬ちはや", "小鳥遊ひより",
  "黒木れい", "白川真央", "九条めぐ", "立花あんな", "羽鳥そら",
  "星宮みら", "霧島ことね", "南条えま", "桐谷ゆず", "瀬戸内なぎ",
  "三笠あかり", "千歳まこ", "雪村しおん", "向日葵ひな", "美川さや",
  "佐倉りこ", "緋色みやび", "葵井のあ", "宝生るり", "天音まりあ",
];

const YEARS = [2026, 2027];

// ---------------------------------------------------------------------------
// 商品（券種）テンプレート
// ---------------------------------------------------------------------------
type Tmpl = {
  name: string;
  type: "PHYSICAL" | "DIGITAL";
  price: number;
  benefit?: string;
  requiresNickname?: boolean;
  perMember?: boolean; // グループイベントでメンバー別バリエーションにする
  sizes?: boolean; // S/M/L/XL バリエーション
  low?: boolean; // 在庫を絞る（売切・残少のテスト用）
  canLotteryOnly?: boolean; // 抽選イベントで当選者限定にできる
};

const MEETGREET_TMPLS: Tmpl[] = [
  { name: "ソロチェキ券", type: "PHYSICAL", price: 1800, benefit: "チェキ", perMember: true },
  { name: "2ショットチェキ券", type: "PHYSICAL", price: 2500, benefit: "直筆サイン入り2ショットチェキ", requiresNickname: true, perMember: true },
  { name: "3ショットチェキ券", type: "PHYSICAL", price: 3200, benefit: "3ショットチェキ", perMember: true },
  { name: "集合チェキ券", type: "PHYSICAL", price: 2000, benefit: "メンバー集合チェキ" },
  { name: "2ショット動画券（30秒）", type: "PHYSICAL", price: 3000, benefit: "オンライン2ショット動画30秒", perMember: true },
  { name: "ソロ動画券（30秒）", type: "PHYSICAL", price: 2400, benefit: "オンラインソロ動画30秒", perMember: true },
  { name: "お話し券（30秒）", type: "PHYSICAL", price: 1500, benefit: "オンライントーク30秒", perMember: true },
  { name: "お話し券（1分）", type: "PHYSICAL", price: 2800, benefit: "オンライントーク1分", perMember: true },
  { name: "お見送り会券", type: "PHYSICAL", price: 1300, benefit: "オンラインお見送り" },
  { name: "ボイスメッセージ券", type: "PHYSICAL", price: 2200, benefit: "個別ボイスメッセージ", requiresNickname: true, perMember: true },
  { name: "直筆サイン入りチェキ", type: "PHYSICAL", price: 3500, benefit: "直筆サイン入り", requiresNickname: true, perMember: true, low: true },
  { name: "直筆サイン入りミニ色紙", type: "PHYSICAL", price: 4200, benefit: "直筆サイン入り", requiresNickname: true, perMember: true, low: true },
  { name: "直筆サイン入りトレカ", type: "PHYSICAL", price: 3800, benefit: "直筆サイン入り", requiresNickname: true, perMember: true, low: true },
  { name: "直筆サイン入りA2ポスター", type: "PHYSICAL", price: 5000, benefit: "直筆サイン入り", requiresNickname: true, low: true, canLotteryOnly: true },
  { name: "直筆サイン入り写真集", type: "PHYSICAL", price: 6500, benefit: "直筆サイン入り", requiresNickname: true, canLotteryOnly: true },
  { name: "ランダムブロマイド（3枚）", type: "PHYSICAL", price: 1200, benefit: "ランダム3枚封入" },
  { name: "限定ステッカーセット", type: "PHYSICAL", price: 900, benefit: "限定ステッカー" },
  { name: "デジタル特典フォトセット", type: "DIGITAL", price: 1500, benefit: "未収録デジタル写真20点" },
];

const KUJI_TMPLS: Tmpl[] = [
  { name: "生誕すきくじ 1回", type: "PHYSICAL", price: 800, benefit: "ランダム景品（A賞〜ラストワン賞）" },
  { name: "生誕すきくじ 5回セット", type: "PHYSICAL", price: 3800, benefit: "ランダム景品×5" },
  { name: "生誕すきくじ 10回セット", type: "PHYSICAL", price: 7500, benefit: "ランダム景品×10" },
  { name: "生誕すきくじ 20回セット", type: "PHYSICAL", price: 14000, benefit: "ランダム景品×20" },
  { name: "コラボすきくじ 1回", type: "PHYSICAL", price: 850, benefit: "コラボ景品ランダム" },
  { name: "おかわりくじ 1回", type: "PHYSICAL", price: 800, benefit: "追加ランダム景品" },
  { name: "ダブルチャンスくじ", type: "PHYSICAL", price: 1000, benefit: "Wチャンス景品" },
  { name: "A賞 アクリルスタンド単品", type: "PHYSICAL", price: 3000, benefit: "A賞景品", low: true },
  { name: "B賞 缶バッジ単品", type: "PHYSICAL", price: 1200, benefit: "B賞景品" },
  { name: "C賞 ブロマイド単品", type: "PHYSICAL", price: 800, benefit: "C賞景品" },
  { name: "ラストワン賞確定枠", type: "PHYSICAL", price: 5000, benefit: "ラストワン賞", low: true },
  { name: "デジタルくじ（フォト当選）", type: "DIGITAL", price: 700, benefit: "ランダムデジタルフォト" },
];

const CARD_TMPLS: Tmpl[] = [
  { name: "カードパック 1パック（5枚）", type: "PHYSICAL", price: 600, benefit: "サイン柄ランダム封入" },
  { name: "カードパック 3パックセット", type: "PHYSICAL", price: 1700, benefit: "サイン柄ランダム封入" },
  { name: "カードパック 1BOX（20パック）", type: "PHYSICAL", price: 11000, benefit: "サイン柄ランダム封入" },
  { name: "カードパック 3BOXセット", type: "PHYSICAL", price: 31000, benefit: "サイン柄ランダム封入", low: true },
  { name: "コンプリートセット", type: "PHYSICAL", price: 18000, benefit: "全種コンプリート", low: true },
  { name: "メンバー別カードパック", type: "PHYSICAL", price: 700, benefit: "推し別カード", perMember: true },
  { name: "ホログラム10パックBOX", type: "PHYSICAL", price: 6500, benefit: "ホログラム柄" },
  { name: "プロモパック", type: "PHYSICAL", price: 1500, benefit: "限定プロモ柄", low: true },
  { name: "スターターデッキ", type: "PHYSICAL", price: 2500, benefit: "スターター" },
  { name: "バインダー付きセット", type: "PHYSICAL", price: 4500, benefit: "専用バインダー付き" },
  { name: "サイン入りSPカード", type: "PHYSICAL", price: 9000, benefit: "直筆サイン入り", requiresNickname: true, low: true, canLotteryOnly: true },
  { name: "デジタルカードパック", type: "DIGITAL", price: 500, benefit: "デジタルトレカ" },
];

const GOODS_TMPLS: Tmpl[] = [
  { name: "アクリルスタンド", type: "PHYSICAL", price: 2200, perMember: true },
  { name: "アクリルキーホルダー", type: "PHYSICAL", price: 1300, perMember: true },
  { name: "ラバーストラップ", type: "PHYSICAL", price: 1100, perMember: true },
  { name: "缶バッジセット", type: "PHYSICAL", price: 1500 },
  { name: "ツアーTシャツ", type: "PHYSICAL", price: 4000, sizes: true },
  { name: "パーカー", type: "PHYSICAL", price: 6500, sizes: true },
  { name: "ペンライト", type: "PHYSICAL", price: 3500 },
  { name: "マフラータオル", type: "PHYSICAL", price: 2500 },
  { name: "トートバッグ", type: "PHYSICAL", price: 3000 },
  { name: "クリアファイルセット", type: "PHYSICAL", price: 800 },
  { name: "ポストカードセット", type: "PHYSICAL", price: 1000 },
  { name: "ステッカーセット", type: "PHYSICAL", price: 700 },
  { name: "スマホケース", type: "PHYSICAL", price: 3800 },
  { name: "ブランケット", type: "PHYSICAL", price: 4500 },
  { name: "ぬいぐるみ", type: "PHYSICAL", price: 3200 },
  { name: "直筆サイン入り限定グッズ", type: "PHYSICAL", price: 8000, benefit: "直筆サイン入り", requiresNickname: true, low: true, canLotteryOnly: true },
];

type EventType = "MEET_GREET" | "KUJI" | "TRADING_CARD" | "GOODS";

function eventTitle(type: EventType, name: string, year: number, variant: number): string {
  if (type === "KUJI") return `${name} 生誕すきくじ${year}`;
  if (type === "TRADING_CARD")
    return variant === 0
      ? `${name} オフィシャルカードパック ${year}`
      : `${name} ${int(1, 5)}th Anniversary カードパック`;
  if (type === "GOODS") return `${name} オフィシャルグッズ ${year}`;
  // MEET_GREET
  const kinds = ["オンライン特典会", "オンラインサイン会", "オンラインビンゴ大会", "大特典会"];
  return `${name} ${pick(kinds)} ${year}`;
}

function templatesFor(type: EventType): Tmpl[] {
  if (type === "KUJI") return KUJI_TMPLS;
  if (type === "TRADING_CARD") return CARD_TMPLS;
  if (type === "GOODS") return GOODS_TMPLS;
  return MEETGREET_TMPLS;
}

const KIND_LABEL: Record<EventType, string> = {
  MEET_GREET: "オンライン特典会",
  KUJI: "生誕すきくじ",
  TRADING_CARD: "オフィシャルトレカ",
  GOODS: "オフィシャルグッズ",
};

function eventDescription(type: EventType, artist: string, members: string[]): string {
  const lines: string[] = ["■イベント内容", `${artist} の${KIND_LABEL[type]}です。`];
  if (type === "MEET_GREET") {
    lines.push(
      "お申し込みいただいた券種に応じて、オンラインでの2ショット撮影・トーク・直筆サイン入り特典などをお楽しみいただけます。",
    );
    if (members.length) {
      lines.push("", "■出演メンバー", members.join("・"));
    }
    lines.push(
      "",
      "■配信方法",
      "公式オンライン特典会システムにて実施します。参加用URLは開催30分前までにマイページへ掲載します。",
    );
  } else if (type === "KUJI") {
    lines.push(
      "1回ご購入ごとに1回抽選。A賞〜ラストワン賞まで、ハズレなしのすきくじです。",
      "",
      "■景品内容",
      "A賞 アクリルスタンド／B賞 缶バッジ／C賞 ブロマイド／ラストワン賞 特製パネル ほか",
    );
  } else if (type === "TRADING_CARD") {
    lines.push("1パック5枚入り。サイン柄・ホログラム柄がランダムで封入されています。");
  } else {
    lines.push("オフィシャルグッズの販売です。");
  }
  lines.push("", "■販売期間／配信予定日", "各商品ページの記載をご確認ください。");
  return lines.join("\n");
}

function eventNotes(type: EventType): string {
  const lines = [
    "■商品の購入について",
    "・ご購入にはログイン（会員登録）が必要です。",
    "・数量・期間限定のため、売切および販売期間終了をもって販売を終了します。",
    "■お支払い方法について",
    "・クレジットカード決済（外部決済サービス）をご利用いただけます。カード情報は当店では保持しません。",
    "■送料について",
    "・物販商品は別途送料がかかる場合があります。",
  ];
  if (type === "MEET_GREET") {
    lines.push(
      "■オンライン特典会のご参加について",
      "・参加用URLは開催30分前までにマイページへ掲載します。",
      "・登録電話番号の変更、再発信（掛け直し）はできません。",
      "■ニックネームに関する注意事項",
      "・サイン宛名となるニックネームは10文字以内・よみがな必須です。ご注文後の変更はできません。",
    );
  }
  lines.push(
    "■商品のキャンセルについて",
    "・ご注文後のキャンセル・変更は原則としてお受けできません。",
  );
  return lines.join("\n");
}

function productDescription(tmpl: Tmpl, artist: string): string {
  const lines = ["■商品名", tmpl.name];
  if (tmpl.benefit) {
    lines.push(
      "",
      "■特典内容",
      tmpl.benefit + (tmpl.requiresNickname ? "（宛名・サイン・一言コメント付き）" : ""),
    );
  }
  lines.push("", "■内容", `${artist} の${tmpl.name}です。`);
  return lines.join("\n");
}

function productNotes(tmpl: Tmpl): string {
  const lines = [
    "■商品について",
    "・画像はイメージです。実物と多少異なる場合があります。",
    "・数量限定につき、売切の際はご容赦ください。",
    "■キャンセルについて",
    "・ご注文後のキャンセル・変更は原則としてお受けできません。",
  ];
  if (tmpl.requiresNickname) {
    lines.push(
      "■ニックネームについて",
      "・サインの宛名になります。10文字以内・よみがな必須です。ご注文後の変更はできません。",
    );
  }
  return lines.join("\n");
}

const NICKNAME_NOTE =
  "サインの宛名になります。10文字以内・よみがな必須。ご注文後の変更はできません。";

// 販売期間の状態（販売中 / 販売予定 / 終了）
function saleWindow(): { start: Date; end: Date } {
  const r = rng();
  if (r < 0.55) return { start: fromNow(-int(1, 20)), end: fromNow(int(2, 30)) }; // 販売中
  if (r < 0.8) return { start: fromNow(int(3, 40)), end: fromNow(int(45, 80)) }; // 予定
  return { start: fromNow(-int(40, 90)), end: fromNow(-int(1, 30)) }; // 終了
}

async function main() {
  console.log("🌱 seeding 100 events / ~1000 products ...");

  // 既存データを全削除（ローカル開発用）
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    operation_logs, revenue_shares, user_digital_contents, digital_contents,
    lottery_entries, lotteries, shipments, payments, order_items, orders,
    cart_items, carts, stock_reservations, inventories, product_variants,
    products, events, password_reset_tokens, users, admin_users
    RESTART IDENTITY CASCADE;`);

  // --- 管理者 ---
  const adminPw = await hash("password123");
  await prisma.adminUser.createMany({
    data: [
      { email: "admin@example.com", passwordHash: adminPw, name: "運営オーナー", role: "OWNER" },
      { email: "manager@example.com", passwordHash: adminPw, name: "販売マネージャー", role: "MANAGER" },
      { email: "operator@example.com", passwordHash: adminPw, name: "オペレーター", role: "OPERATOR" },
    ],
  });

  // --- 一般ユーザー（テストユーザー + ダミー20名） ---
  // 抽選の指名フィルター用に gender / joinedAt も付与する。
  // ファン番号で決定的に振り分け、ハイブリッド抽選デモ時の挙動を再現しやすくする。
  const userPw = await hash("password123");
  const genderRotation: ("MALE" | "FEMALE" | "OTHER" | "UNDISCLOSED")[] = [
    "FEMALE",
    "FEMALE",
    "FEMALE",
    "MALE",
    "MALE",
    "OTHER",
    "UNDISCLOSED",
  ];
  const users: Prisma.UserCreateManyInput[] = [
    {
      id: randomUUID(),
      email: "user@example.com",
      passwordHash: userPw,
      name: "テスト太郎",
      nameKana: "テストタロウ",
      phone: "09012345678",
      postalCode: "1500001",
      address: "東京都渋谷区神宮前1-1-1",
      gender: "MALE",
      // 入会から3年以上の古参想定
      joinedAt: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000),
    },
  ];
  for (let i = 1; i <= 20; i++) {
    users.push({
      id: randomUUID(),
      email: `fan${String(i).padStart(2, "0")}@example.com`,
      passwordHash: userPw,
      name: `ファン${i}`,
      postalCode: "1000001",
      address: "東京都千代田区1-1",
      gender: genderRotation[i % genderRotation.length],
      // i に応じて入会年数を 1〜30か月の幅で散らす
      joinedAt: new Date(Date.now() - (30 + i * 30) * 24 * 60 * 60 * 1000),
    });
  }
  await prisma.user.createMany({ data: users });
  const testUserId = users[0].id as string;

  // --- イベント / 商品 / バリエーション / 在庫を生成 ---
  const events: Prisma.EventCreateManyInput[] = [];
  const products: Prisma.ProductCreateManyInput[] = [];
  const variants: Prisma.ProductVariantCreateManyInput[] = [];
  const inventories: Prisma.InventoryCreateManyInput[] = [];

  // 各 variant のメタを保持（注文/抽選生成に利用）
  type VariantMeta = {
    id: string;
    productId: string;
    eventId: string;
    type: "PHYSICAL" | "DIGITAL";
    price: number;
    productName: string;
    variantName: string;
    lotteryOnly: boolean;
  };
  const variantMetas: VariantMeta[] = [];
  // 抽選イベントの当選者限定 productId を保持
  const lotteryEventProducts: { eventId: string; productId: string; productName: string; title: string }[] = [];
  const digitalContentSeeds: { id: string; productId: string; title: string; fileKey: string }[] = [];

  const TYPE_WEIGHTS: EventType[] = [
    ...Array(45).fill("MEET_GREET"),
    ...Array(20).fill("KUJI"),
    ...Array(20).fill("TRADING_CARD"),
    ...Array(15).fill("GOODS"),
  ];

  const EVENT_COUNT = 100;
  for (let ei = 0; ei < EVENT_COUNT; ei++) {
    const type = pick(TYPE_WEIGHTS) as EventType;
    const isGroupEvent = type === "TRADING_CARD" || type === "GOODS" || chance(0.4);
    const artist = isGroupEvent ? pick(GROUPS) : pick(MEMBERS);
    const groupMembers = isGroupEvent ? shuffle(MEMBERS).slice(0, int(3, 6)) : [];
    const year = pick(YEARS);
    const win = saleWindow();
    const published = chance(0.9);
    const saleMethod =
      type === "MEET_GREET" && chance(0.35) ? "LOTTERY" : chance(0.1) ? "LOTTERY" : "FIRST_COME";

    const eventId = randomUUID();
    const eventDate =
      type === "MEET_GREET" ? fromNow(int(3, 60), int(0, 20)) : null;

    events.push({
      id: eventId,
      slug: `event-${ei + 1}`,
      title: eventTitle(type, artist, year, ei % 2),
      artistName: artist,
      eventType: type,
      saleMethod,
      description: eventDescription(type, artist, groupMembers),
      coverImageUrl: `https://picsum.photos/seed/ev${ei + 1}/1200/675`,
      eventDate,
      isPublished: published,
      saleStartAt: win.start,
      saleEndAt: win.end,
      maxPerUser: chance(0.3) ? int(5, 30) : null,
      notes: eventNotes(type),
    });

    // 商品生成（1イベントあたり 8〜14 券種）
    const pool = templatesFor(type);
    const want = int(8, 14);
    const chosen = shuffle(pool).slice(0, Math.min(pool.length, want));

    let madeLotteryOnly = false;
    chosen.forEach((tmpl, pi) => {
      const productId = randomUUID();
      const lotteryOnly =
        saleMethod === "LOTTERY" && !!tmpl.canLotteryOnly && !madeLotteryOnly && chance(0.8);
      if (lotteryOnly) madeLotteryOnly = true;

      products.push({
        id: productId,
        eventId,
        slug: `product-${ei + 1}-${pi + 1}`,
        name: tmpl.name + (isGroupEvent ? "" : `／${artist}`),
        description: productDescription(tmpl, artist),
        type: tmpl.type,
        basePrice: tmpl.price,
        benefit: tmpl.benefit ?? null,
        deliveryDate: fromNow(int(7, 50)),
        notes: productNotes(tmpl),
        nicknameNote: tmpl.requiresNickname ? NICKNAME_NOTE : null,
        imageUrl: `https://picsum.photos/seed/pr${ei + 1}x${pi + 1}/600/600`,
        isPublished: published && chance(0.95),
        maxPerOrder: tmpl.low ? 1 : pick([null, null, 2, 3, 5, 10]),
        maxPerUser: tmpl.low ? int(1, 2) : chance(0.3) ? int(2, 10) : null,
        lotteryOnly,
        requiresNickname: !!tmpl.requiresNickname,
      });

      // バリエーション
      let variantNames: string[];
      if (tmpl.sizes) variantNames = ["S", "M", "L", "XL"];
      else if (tmpl.perMember && isGroupEvent) variantNames = groupMembers;
      else variantNames = ["通常"];

      variantNames.forEach((vn, vi) => {
        const variantId = randomUUID();
        const priceJitter = tmpl.sizes && vn === "XL" ? 300 : 0;
        const price = tmpl.price + priceJitter;
        // 在庫: low テンプレは少なめ（0含む）、デジタルは大量
        // low テンプレは 0〜12（売切・残少テスト用）、通常は 20〜500
        const qty = tmpl.type === "DIGITAL" ? 99999 : tmpl.low ? int(0, 12) : int(20, 500);
        variants.push({
          id: variantId,
          productId,
          name: vn,
          sku: `SKU-${ei + 1}-${pi + 1}-${vi + 1}`,
          price,
          isDefault: vi === 0,
          requiresNickname: !!tmpl.requiresNickname,
        });
        inventories.push({ id: randomUUID(), variantId, quantity: qty });
        variantMetas.push({
          id: variantId,
          productId,
          eventId,
          type: tmpl.type,
          price,
          productName: tmpl.name,
          variantName: vn,
          lotteryOnly,
        });
      });

      // デジタルコンテンツ
      if (tmpl.type === "DIGITAL" && chance(0.8)) {
        digitalContentSeeds.push({
          id: randomUUID(),
          productId,
          title: `${artist}｜${tmpl.name}`,
          fileKey: "seed-demo-digital.txt",
        });
      }

      if (lotteryOnly) {
        lotteryEventProducts.push({
          eventId,
          productId,
          productName: tmpl.name,
          title: eventTitle(type, artist, year, ei % 2),
        });
      }
    });
  }

  console.log(`  events=${events.length} products=${products.length} variants=${variants.length}`);

  // バルク投入
  await prisma.event.createMany({ data: events });
  // products / variants / inventories は件数が多いので分割投入
  const chunk = <T>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };
  for (const c of chunk(products, 500)) await prisma.product.createMany({ data: c });
  for (const c of chunk(variants, 500)) await prisma.productVariant.createMany({ data: c });
  for (const c of chunk(inventories, 500)) await prisma.inventory.createMany({ data: c });

  // --- デジタルコンテンツ用ファイル + レコード ---
  const storageDir = path.join(process.cwd(), "storage");
  await mkdir(storageDir, { recursive: true });
  await writeFile(
    path.join(storageDir, "seed-demo-digital.txt"),
    "Avelia FunClub デモ用デジタルコンテンツ（ダミーファイル）",
  );
  if (digitalContentSeeds.length > 0) {
    await prisma.digitalContent.createMany({
      data: digitalContentSeeds.map((d) => ({
        id: d.id,
        productId: d.productId,
        title: d.title,
        description: "デモ用デジタルコンテンツ。",
        type: "FILE",
        fileKey: d.fileKey,
        viewLimitDays: 365,
      })),
    });
  }

  // --- 抽選（当選者限定商品があるイベント）+ テストユーザーの応募 ---
  const lotterySeed = shuffle(lotteryEventProducts).slice(0, 30);
  let entryCount = 0;
  const userEntryStatuses = ["WON", "LOST", "ENTERED"] as const;
  for (let i = 0; i < lotterySeed.length; i++) {
    const lp = lotterySeed[i];
    const lottery = await prisma.lottery.create({
      data: {
        eventId: lp.eventId,
        productId: lp.productId,
        title: `${lp.productName} 購入抽選`,
        description: "当選者のみ対象商品をご購入いただけます。",
        entryStartAt: fromNow(-int(10, 20)),
        entryEndAt: fromNow(-int(1, 5)),
        winnersCount: int(20, 100),
        purchaseDeadlineAt: fromNow(int(3, 14)),
        status: i < 20 ? "DRAWN" : "CLOSED",
      },
    });
    // テストユーザーは先頭6件に応募（当選/落選/応募中を散らす）
    if (i < 6) {
      const status = i < 20 ? userEntryStatuses[i % 3] : "ENTERED";
      await prisma.lotteryEntry.create({
        data: {
          lotteryId: lottery.id,
          userId: testUserId,
          status,
          wonAt: status === "WON" ? fromNow(-2) : null,
          purchaseDeadlineAt: status === "WON" ? fromNow(int(3, 10)) : null,
        },
      });
      entryCount++;
    }
  }

  // --- ダミー注文（管理ダッシュボード用） + 在庫 sold 反映 ---
  const sellable = variantMetas.filter((v) => v.type === "PHYSICAL" && !v.lotteryOnly);
  const soldDelta = new Map<string, number>();
  const userIds = users.map((u) => u.id as string);
  let orderNo = 1;
  for (let i = 0; i < 60; i++) {
    const buyer = pick(userIds);
    const lineCount = int(1, 3);
    const lines = shuffle(sellable).slice(0, lineCount);
    if (lines.length === 0) continue;
    const isPaid = chance(0.8);
    const subtotal = lines.reduce((s, l) => s + l.price * 1, 0);
    const shippingFee = 660;
    const total = subtotal + shippingFee;
    const order = await prisma.order.create({
      data: {
        orderNumber: `AV-202606-${String(orderNo++).padStart(5, "0")}`,
        userId: buyer,
        status: isPaid ? "PAID" : "PENDING",
        currency: "jpy",
        subtotal,
        shippingFee,
        total,
        paidAt: isPaid ? fromNow(-int(1, 20)) : null,
        recipientName: "ファン購入者",
        recipientPostal: "1000001",
        recipientAddress: "東京都千代田区1-1",
        shippingMethod: "宅配便",
        reservationExpiresAt: isPaid ? null : fromNow(0, 1),
        items: {
          create: lines.map((l) => ({
            variantId: l.id,
            productName: l.productName,
            variantName: l.variantName,
            unitPrice: l.price,
            quantity: 1,
          })),
        },
        payment: {
          create: {
            provider: "STRIPE",
            status: isPaid ? "PAID" : "PENDING",
            amount: total,
            currency: "jpy",
            paidAt: isPaid ? fromNow(-int(1, 20)) : null,
            providerPaymentId: isPaid ? `seed_${randomUUID().slice(0, 12)}` : null,
          },
        },
      },
    });
    if (isPaid) {
      await prisma.shipment.create({
        data: { orderId: order.id, status: pick(["UNFULFILLED", "PREPARING", "SHIPPED", "DELIVERED"]) },
      });
      for (const l of lines) soldDelta.set(l.id, (soldDelta.get(l.id) ?? 0) + 1);
    }
  }
  // sold 反映
  for (const [variantId, sold] of soldDelta) {
    await prisma.inventory.update({ where: { variantId }, data: { sold } });
  }

  // --- テストユーザーにデジタルコンテンツを1件付与 ---
  if (digitalContentSeeds.length > 0) {
    await prisma.userDigitalContent.create({
      data: {
        userId: testUserId,
        digitalContentId: digitalContentSeeds[0].id,
        expiresAt: fromNow(365),
      },
    });
  }

  // --- 個別サイン納品（PERSONALIZED）のサンプル ---
  // 原本・成果物のダミーファイルを配置
  await writeFile(
    path.join(storageDir, "seed-base-image.png"),
    "Avelia FunClub デモ用 サイン前ベース画像（ダミー）",
  );
  await writeFile(
    path.join(storageDir, "seed-signed-sample.txt"),
    "Avelia FunClub デモ用 サイン済み成果物（ダミー）",
  );

  // サイン入りデジタル写真集（PERSONALIZED）商品をevents[0]に追加
  const signedEventId = events[0].id as string;
  const signedProduct = await prisma.product.create({
    data: {
      eventId: signedEventId,
      slug: "signed-digital-photobook-demo",
      name: "【サイン入り】デジタル写真集（宛名入り）",
      description:
        "■特典内容\n表紙にあなたの宛名＋直筆サインを入れてデジタルでお届けします。\n■配信方法\nご購入・宛名入力後、サイン制作が完了するとマイページからダウンロードいただけます。",
      type: "DIGITAL",
      basePrice: 3000,
      benefit: "表紙に宛名＋直筆サイン",
      notes: "■注意事項\n・ご注文後の宛名変更・キャンセルはお受けできません。",
      nicknameNote: "表紙に記載する宛名です。10文字以内・よみがな必須。",
      isPublished: true,
      deliveryDate: fromNow(7),
      variants: {
        create: [
          {
            name: "通常",
            sku: "SIGNED-DIGITAL-DEMO",
            price: 3000,
            isDefault: true,
            requiresNickname: true,
            inventory: { create: { quantity: 9999 } },
          },
        ],
      },
    },
    include: { variants: true },
  });

  const signedContent = await prisma.digitalContent.create({
    data: {
      productId: signedProduct.id,
      title: "サイン入りデジタル写真集",
      description: "表紙に宛名＋直筆サイン入りのデジタル写真集。",
      type: "IMAGE",
      deliveryType: "PERSONALIZED",
      baseImageKey: "seed-base-image.png",
      viewLimitDays: 365,
    },
  });

  // テストユーザーの PAID 注文（数量2・宛名2件）
  const signedVariant = signedProduct.variants[0];
  const signedUnits = [
    { nickname: "ひな", nicknameKana: "ヒナ", note: null },
    { nickname: "さくら", nicknameKana: "サクラ", note: null },
  ];
  const signedOrder = await prisma.order.create({
    data: {
      orderNumber: `AV-202606-${String(orderNo++).padStart(5, "0")}`,
      userId: testUserId,
      status: "PAID",
      currency: "jpy",
      subtotal: signedVariant.price * 2,
      shippingFee: 0,
      total: signedVariant.price * 2,
      paidAt: fromNow(-1),
      recipientName: "テスト太郎",
      items: {
        create: [
          {
            variantId: signedVariant.id,
            productName: signedProduct.name,
            variantName: signedVariant.name,
            unitPrice: signedVariant.price,
            quantity: 2,
            nickname: signedUnits[0].nickname,
            nicknameKana: signedUnits[0].nicknameKana,
            unitNicknames: signedUnits,
          },
        ],
      },
      payment: {
        create: {
          provider: "STRIPE",
          status: "PAID",
          amount: signedVariant.price * 2,
          currency: "jpy",
          paidAt: fromNow(-1),
          providerPaymentId: `seed_${randomUUID().slice(0, 12)}`,
        },
      },
    },
    include: { items: true },
  });
  const signedItem = signedOrder.items[0];

  // 1個目=READY（納品済）、2個目=PENDING（制作待ち）
  await prisma.digitalDelivery.create({
    data: {
      digitalContentId: signedContent.id,
      orderId: signedOrder.id,
      orderItemId: signedItem.id,
      userId: testUserId,
      unitIndex: 0,
      nickname: signedUnits[0].nickname,
      nicknameKana: signedUnits[0].nicknameKana,
      status: "READY",
      fileKey: "seed-signed-sample.txt",
      originalFilename: "hina_signed.png",
      deliveredAt: fromNow(0),
      expiresAt: fromNow(365),
    },
  });
  await prisma.digitalDelivery.create({
    data: {
      digitalContentId: signedContent.id,
      orderId: signedOrder.id,
      orderItemId: signedItem.id,
      userId: testUserId,
      unitIndex: 1,
      nickname: signedUnits[1].nickname,
      nicknameKana: signedUnits[1].nicknameKana,
      status: "PENDING",
    },
  });

  console.log("✅ seed done");
  console.log(`   events=${events.length}, products=${products.length}, variants=${variants.length}`);
  console.log(`   lotteries=${lotterySeed.length}, testUserEntries=${entryCount}, orders≈60`);
  console.log("   admin: admin@example.com / password123（manager/operator も同パスワード）");
  console.log("   user : user@example.com  / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
