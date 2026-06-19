/**
 * デモ用に STAR PRISM オフィシャルグッズ 2026 イベントへ PAID 注文を増やす。
 *
 * 目的: 制作リスト画面で「タレント（メンバー）で絞り込み」を動かしたとき、
 *       各メンバーに最低 2 件以上の注文が紐づいて見えるようにする。
 *
 * 流用元: 既存の任意の一般ユーザー（user@example.com / fan0X@example.com 等）。
 * 注文番号: AV-DEMO-SP-NNN（既存があれば冪等にスキップ）。
 */
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";

const EVENT_TITLE_LIKE = "STAR PRISM オフィシャルグッズ";

const MEMBERS = [
  "三笠あかり",
  "白石こはく",
  "雪村しおん",
  "一ノ瀬みか",
  "白川真央",
  "千歳まこ",
] as const;

// 各メンバーに対して使うニックネーム（サイン宛名）候補。ローテーションで使用。
const NICKNAME_POOL: { nickname: string; nicknameKana: string }[] = [
  { nickname: "ひな", nicknameKana: "ヒナ" },
  { nickname: "さくら", nicknameKana: "サクラ" },
  { nickname: "あおい", nicknameKana: "アオイ" },
  { nickname: "まりあ", nicknameKana: "マリア" },
  { nickname: "ことね", nicknameKana: "コトネ" },
  { nickname: "つむぎ", nicknameKana: "ツムギ" },
  { nickname: "ゆい", nicknameKana: "ユイ" },
  { nickname: "りん", nicknameKana: "リン" },
];

type VariantPick = {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  unitPrice: number;
  requiresNickname: boolean;
};

async function loadEvent() {
  const event = await prisma.event.findFirst({
    where: { title: { contains: EVENT_TITLE_LIKE } },
    include: {
      products: {
        include: { variants: true },
      },
    },
  });
  if (!event) throw new Error("STAR PRISM イベントが見つかりません");
  return event;
}

async function pickUsers(count: number) {
  const users = await prisma.user.findMany({
    where: { email: { not: { endsWith: "@deleted.local" } } },
    orderBy: { createdAt: "asc" },
    take: count,
    select: {
      id: true,
      email: true,
      name: true,
      nameKana: true,
      phone: true,
      postalCode: true,
      address: true,
    },
  });
  if (users.length === 0) throw new Error("一般ユーザーが見つかりません");
  return users;
}

function variantOfMember(
  products: Awaited<ReturnType<typeof loadEvent>>["products"],
  member: string,
  productNameHint?: string,
): VariantPick | null {
  // 1) ヒント付き: 商品名で当たりをつけて該当バリアントを返す
  if (productNameHint) {
    const p = products.find((p) => p.name.includes(productNameHint));
    if (p) {
      const v = p.variants.find((v) => v.name === member);
      if (v)
        return {
          variantId: v.id,
          productId: p.id,
          productName: p.name,
          variantName: v.name,
          unitPrice: v.price,
          requiresNickname: v.requiresNickname,
        };
    }
  }
  // 2) ヒント無し: 全商品から名前 == member の最初のバリアントを返す
  for (const p of products) {
    const v = p.variants.find((v) => v.name === member);
    if (v) {
      return {
        variantId: v.id,
        productId: p.id,
        productName: p.name,
        variantName: v.name,
        unitPrice: v.price,
        requiresNickname: v.requiresNickname,
      };
    }
  }
  return null;
}

function signedVariant(
  products: Awaited<ReturnType<typeof loadEvent>>["products"],
): VariantPick | null {
  const p = products.find((p) => p.name.includes("直筆サイン"));
  if (!p) return null;
  const v = p.variants[0];
  if (!v) return null;
  return {
    variantId: v.id,
    productId: p.id,
    productName: p.name,
    variantName: v.name,
    unitPrice: v.price,
    requiresNickname: v.requiresNickname,
  };
}

type OrderSpec = {
  orderNumber: string;
  userIndex: number; // ユーザーローテ用 index
  items: Array<{
    variant: VariantPick;
    quantity: number;
    nicknames?: { nickname: string; nicknameKana: string }[]; // 数量分
  }>;
};

async function main() {
  const event = await loadEvent();
  const users = await pickUsers(8);
  console.log(`event=${event.title} users=${users.length}`);

  // 各メンバーごとに「アクリルスタンド × 1 + アクリルキーホルダー × 2」など
  // 最低 2 件以上ぶら下がるように設計する。
  // 加えてニックネーム必須の「直筆サイン入り限定グッズ」を全体で 2 件挿入。
  const specs: OrderSpec[] = [];

  let counter = 1;
  const nextNo = () =>
    `AV-DEMO-SP-${String(counter++).padStart(3, "0")}`;

  // 1) 全メンバーをアクリルスタンドで購入する注文
  specs.push({
    orderNumber: nextNo(),
    userIndex: 0,
    items: MEMBERS.flatMap((m) => {
      const v = variantOfMember(event.products, m, "アクリルスタンド");
      return v ? [{ variant: v, quantity: 1 }] : [];
    }),
  });

  // 2) 全メンバーをアクリルキーホルダー × 2 で購入する注文
  specs.push({
    orderNumber: nextNo(),
    userIndex: 1,
    items: MEMBERS.flatMap((m) => {
      const v = variantOfMember(event.products, m, "アクリルキーホルダー");
      return v ? [{ variant: v, quantity: 2 }] : [];
    }),
  });

  // 3) メンバーごとの "推し買い" 注文を追加。1人1注文ずつ作る
  MEMBERS.forEach((m, idx) => {
    const stand = variantOfMember(event.products, m, "アクリルスタンド");
    const acrylic = variantOfMember(event.products, m, "アクリルキーホルダー");
    const items = [
      ...(stand ? [{ variant: stand, quantity: 1 }] : []),
      ...(acrylic ? [{ variant: acrylic, quantity: 3 }] : []),
    ];
    if (items.length === 0) return;
    specs.push({
      orderNumber: nextNo(),
      userIndex: 2 + (idx % Math.max(1, users.length - 2)),
      items,
    });
  });

  // 4) ニックネーム必須の「直筆サイン入り限定グッズ」を 2 件追加（合計 3 名分）
  const signed = signedVariant(event.products);
  if (signed) {
    specs.push({
      orderNumber: nextNo(),
      userIndex: 0,
      items: [
        {
          variant: signed,
          quantity: 2,
          nicknames: [NICKNAME_POOL[0], NICKNAME_POOL[1]],
        },
      ],
    });
    specs.push({
      orderNumber: nextNo(),
      userIndex: 1,
      items: [
        {
          variant: signed,
          quantity: 1,
          nicknames: [NICKNAME_POOL[2]],
        },
      ],
    });
  }

  // 5) ユーザー側のデフォルトも見やすくするためサイズ別の "パーカー" 購入も少しだけ
  for (const size of ["S", "M", "L", "XL"]) {
    const v = variantOfMember(event.products, size, "パーカー");
    if (!v) continue;
    specs.push({
      orderNumber: nextNo(),
      userIndex: 3,
      items: [{ variant: v, quantity: 1 }],
    });
  }

  // 投入
  for (const s of specs) {
    const existing = await prisma.order.findUnique({
      where: { orderNumber: s.orderNumber },
      select: { id: true },
    });
    if (existing) {
      console.log(`[skip] ${s.orderNumber} 既存`);
      continue;
    }
    const user = users[s.userIndex % users.length];
    if (s.items.length === 0) {
      console.log(`[skip] ${s.orderNumber} 明細なし`);
      continue;
    }
    const subtotal = s.items.reduce(
      (sum, i) => sum + i.variant.unitPrice * i.quantity,
      0,
    );
    const total = subtotal; // 送料0で進める（デモ）

    await prisma.order.create({
      data: {
        orderNumber: s.orderNumber,
        userId: user.id,
        status: "PAID",
        subtotal,
        shippingFee: 0,
        total,
        recipientName: user.name ?? "テスト太郎",
        recipientKana: user.nameKana ?? "テストタロウ",
        recipientPhone: user.phone ?? "0301234567",
        recipientPostal: user.postalCode ?? "1000001",
        recipientAddress: user.address ?? "東京都千代田区千代田1-1",
        shippingMethod: "STANDARD",
        paidAt: new Date(),
        items: {
          create: s.items.map((i) => ({
            variantId: i.variant.variantId,
            productName: i.variant.productName,
            variantName: i.variant.variantName,
            unitPrice: i.variant.unitPrice,
            quantity: i.quantity,
            // 単一/数量分のニックネーム
            nickname: i.nicknames?.[0]?.nickname ?? null,
            nicknameKana: i.nicknames?.[0]?.nicknameKana ?? null,
            unitNicknames: i.nicknames
              ? i.nicknames.map((n) => ({
                  nickname: n.nickname,
                  nicknameKana: n.nicknameKana,
                  note: null,
                }))
              : undefined,
          })),
        },
        payment: {
          create: {
            provider: "STRIPE",
            status: "PAID",
            amount: total,
            currency: "jpy",
            paidAt: new Date(),
            providerPaymentId: `seed_demo_${randomUUID().slice(0, 12)}`,
          },
        },
      },
    });
    console.log(`[ok] ${s.orderNumber} items=${s.items.length} total=${total}`);
  }

  console.log("✅ done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
