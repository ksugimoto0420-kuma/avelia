/**
 * デモ用に user@example.com 向けの「サイン未記入（PENDING）」納品データを
 * 複数件作る。
 *
 * 構成:
 *   既存の PERSONALIZED コンテンツに加え、注文ベースで以下を投入。
 *
 *   注文 AV-DEMO-SIGN-A: 星野ひなた / サイン入りデジタル写真 数量3
 *     → PENDING Delivery 3件（宛名: あい・ゆい・りん）
 *
 *   注文 AV-DEMO-SIGN-B: 別タレント / 新規 PERSONALIZED コンテンツ 数量2
 *     → PENDING Delivery 2件（宛名: つむぎ・さくら）
 *
 * 冪等: 既存のデモ注文があれば削除して入れ直す（関連 deliveries / payments も）。
 *
 * デモ時の流れ:
 *   1. /admin/digital-deliveries で PENDING が並んでいるのを見せる
 *   2. /admin/sign-session 経由でサインを書く
 *      （または事前にこちらでサインを書き込んでおいて承認だけ見せる）
 *   3. ユーザー側 /mypage/digital-contents で「制作中」→「DL可」に変化
 */
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";

const ORDER_PREFIX = "AV-DEMO-SIGN-";

async function findVariantOfPersonalized() {
  // PERSONALIZED コンテンツのうち、product/event が公開状態のもの
  const contents = await prisma.digitalContent.findMany({
    where: {
      deliveryType: "PERSONALIZED",
      product: { isPublished: true, event: { isPublished: true } },
    },
    include: {
      product: {
        include: {
          variants: { include: { inventory: true } },
          event: { select: { id: true, title: true, artistId: true } },
        },
      },
    },
  });
  return contents;
}

async function deleteExisting(orderNumber: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true },
  });
  if (!order) return;
  await prisma.signature.deleteMany({
    where: { delivery: { orderId: order.id } },
  });
  await prisma.digitalDelivery.deleteMany({ where: { orderId: order.id } });
  await prisma.payment.deleteMany({ where: { orderId: order.id } });
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
}

type Nick = { nickname: string; nicknameKana: string };

async function createOrderWithDeliveries(params: {
  orderNumber: string;
  userId: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  unitPrice: number;
  contents: { id: string }[];
  nicknames: Nick[];
}) {
  const qty = params.nicknames.length;
  const order = await prisma.order.create({
    data: {
      orderNumber: params.orderNumber,
      userId: params.userId,
      status: "PAID",
      subtotal: params.unitPrice * qty,
      shippingFee: 0,
      total: params.unitPrice * qty,
      paidAt: new Date(),
      recipientName: "テスト太郎",
      items: {
        create: [
          {
            variantId: params.variantId,
            productName: params.productName,
            variantName: params.variantName,
            unitPrice: params.unitPrice,
            quantity: qty,
            nickname: params.nicknames[0]?.nickname ?? null,
            nicknameKana: params.nicknames[0]?.nicknameKana ?? null,
            unitNicknames: params.nicknames.map((n) => ({
              nickname: n.nickname,
              nicknameKana: n.nicknameKana,
              note: null,
            })),
          },
        ],
      },
      payment: {
        create: {
          provider: "STRIPE",
          status: "PAID",
          amount: params.unitPrice * qty,
          currency: "jpy",
          paidAt: new Date(),
          providerPaymentId: `seed_demo_${randomUUID().slice(0, 12)}`,
        },
      },
    },
    include: { items: true },
  });
  const orderItem = order.items[0];

  for (const c of params.contents) {
    for (let unitIndex = 0; unitIndex < qty; unitIndex++) {
      const n = params.nicknames[unitIndex];
      await prisma.digitalDelivery.create({
        data: {
          digitalContentId: c.id,
          orderId: order.id,
          orderItemId: orderItem.id,
          userId: params.userId,
          unitIndex,
          nickname: n.nickname,
          nicknameKana: n.nicknameKana,
          status: "PENDING",
        },
      });
    }
  }
  return order;
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "user@example.com" },
    select: { id: true },
  });
  if (!user) throw new Error("user@example.com が見つかりません");

  const personalizedContents = await findVariantOfPersonalized();
  if (personalizedContents.length === 0)
    throw new Error("PERSONALIZED コンテンツが見つかりません");

  // 上から 2 件を使う（複数の商品で PENDING を作ってデモを盛る）
  // 1件目: 既存「星野ひなた」、2件目: それ以外で取れた最初のもの
  const c1 = personalizedContents[0];
  const c2 = personalizedContents.find(
    (c) => c.productId !== c1.productId,
  ) ?? null;

  console.log(`Content #1: ${c1.title} / event=${c1.product?.event.title}`);
  if (c2)
    console.log(`Content #2: ${c2.title} / event=${c2.product?.event.title}`);
  else console.log("Content #2: 別 product 無し（#1 のみで進める）");

  await deleteExisting(`${ORDER_PREFIX}A`);
  await deleteExisting(`${ORDER_PREFIX}B`);

  // 1件目の注文（数量 3）
  const v1 = c1.product!.variants[0];
  await createOrderWithDeliveries({
    orderNumber: `${ORDER_PREFIX}A`,
    userId: user.id,
    variantId: v1.id,
    productId: c1.product!.id,
    productName: c1.product!.name,
    variantName: v1.name,
    unitPrice: v1.price,
    contents: [{ id: c1.id }],
    nicknames: [
      { nickname: "あい", nicknameKana: "アイ" },
      { nickname: "ゆい", nicknameKana: "ユイ" },
      { nickname: "りん", nicknameKana: "リン" },
    ],
  });
  console.log(`✓ 注文 ${ORDER_PREFIX}A 作成、PENDING 3件`);

  // 2件目の注文（数量 2）
  if (c2) {
    const v2 = c2.product!.variants[0];
    await createOrderWithDeliveries({
      orderNumber: `${ORDER_PREFIX}B`,
      userId: user.id,
      variantId: v2.id,
      productId: c2.product!.id,
      productName: c2.product!.name,
      variantName: v2.name,
      unitPrice: v2.price,
      contents: [{ id: c2.id }],
      nicknames: [
        { nickname: "つむぎ", nicknameKana: "ツムギ" },
        { nickname: "さくら", nicknameKana: "サクラ" },
      ],
    });
    console.log(`✓ 注文 ${ORDER_PREFIX}B 作成、PENDING 2件`);
  }

  // 集計
  const ds = await prisma.digitalDelivery.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { digitalContent: { select: { title: true } } },
  });
  console.log(`\nuser@example.com の納品: ${ds.length} 件`);
  const byStatus: Record<string, number> = {};
  for (const d of ds) {
    byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
  }
  console.log(`  内訳: ${JSON.stringify(byStatus)}`);
  console.log("✅ done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
