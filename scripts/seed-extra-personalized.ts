/**
 * 2 件目の PERSONALIZED デジタルコンテンツを新規作成し、user@example.com の
 * PENDING 納品も追加投入してデモを盛る。
 *
 * 流れ:
 *   1. 販売中の物販イベント配下から「直筆サイン入り写真集」系商品を 1 つ拾う
 *   2. その商品に対して新しく PERSONALIZED の DigitalContent を作る
 *      （baseImageUrl は商品の imageUrl を流用）
 *   3. user@example.com の新規注文 AV-DEMO-SIGN-B を作り、
 *      数量 2 の PENDING Delivery を生成
 */
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";

const ORDER_NUMBER = "AV-DEMO-SIGN-B";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "user@example.com" },
    select: { id: true },
  });
  if (!user) throw new Error("no user");

  // 既存の AV-DEMO-SIGN-B があれば全部削除（冪等）
  const existing = await prisma.order.findUnique({
    where: { orderNumber: ORDER_NUMBER },
    select: { id: true },
  });
  if (existing) {
    await prisma.signature.deleteMany({
      where: { delivery: { orderId: existing.id } },
    });
    await prisma.digitalDelivery.deleteMany({
      where: { orderId: existing.id },
    });
    await prisma.payment.deleteMany({ where: { orderId: existing.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: existing.id } });
    await prisma.order.delete({ where: { id: existing.id } });
  }

  // 既存の星野ひなた product (= 既存 PERSONALIZED) を避け、別 product を選ぶ
  const exclude = await prisma.digitalContent.findFirst({
    where: { deliveryType: "PERSONALIZED" },
    select: { productId: true },
  });

  // 「直筆サイン入り写真集」系の物販で、まだ PERSONALIZED コンテンツが
  // 付いていない商品を 1 つ。
  const product = await prisma.product.findFirst({
    where: {
      isPublished: true,
      event: { isPublished: true },
      name: { contains: "直筆サイン入り写真集" },
      digitalContents: { none: {} },
      id: exclude?.productId ? { not: exclude.productId } : undefined,
    },
    include: {
      variants: { include: { inventory: true } },
      event: { select: { id: true, title: true } },
    },
  });
  if (!product) throw new Error("対象の物販商品が見つかりません");
  const variant = product.variants[0];
  console.log(`対象: ${product.event.title} / ${product.name} / ${variant.name}`);

  // PERSONALIZED コンテンツを作成
  const content = await prisma.digitalContent.create({
    data: {
      productId: product.id,
      title: `${product.name}（サイン入りデジタル版）`,
      description: "サイン入りデジタル写真の納品用コンテンツ（デモ）",
      type: "IMAGE",
      deliveryType: "PERSONALIZED",
      baseImageUrl: product.imageUrl,
      viewLimitDays: 365,
      downloadLimit: 5,
    },
  });
  console.log(`✓ DigitalContent 作成 id=${content.id}`);

  // 注文を作成（数量 2）
  const qty = 2;
  const nicknames = [
    { nickname: "つむぎ", nicknameKana: "ツムギ" },
    { nickname: "さくら", nicknameKana: "サクラ" },
  ];
  const order = await prisma.order.create({
    data: {
      orderNumber: ORDER_NUMBER,
      userId: user.id,
      status: "PAID",
      subtotal: variant.price * qty,
      shippingFee: 0,
      total: variant.price * qty,
      paidAt: new Date(),
      recipientName: "テスト太郎",
      items: {
        create: [
          {
            variantId: variant.id,
            productName: product.name,
            variantName: variant.name,
            unitPrice: variant.price,
            quantity: qty,
            nickname: nicknames[0].nickname,
            nicknameKana: nicknames[0].nicknameKana,
            unitNicknames: nicknames.map((n) => ({ ...n, note: null })),
          },
        ],
      },
      payment: {
        create: {
          provider: "STRIPE",
          status: "PAID",
          amount: variant.price * qty,
          currency: "jpy",
          paidAt: new Date(),
          providerPaymentId: `seed_demo_${randomUUID().slice(0, 12)}`,
        },
      },
    },
    include: { items: true },
  });
  const item = order.items[0];

  for (let i = 0; i < qty; i++) {
    await prisma.digitalDelivery.create({
      data: {
        digitalContentId: content.id,
        orderId: order.id,
        orderItemId: item.id,
        userId: user.id,
        unitIndex: i,
        nickname: nicknames[i].nickname,
        nicknameKana: nicknames[i].nicknameKana,
        status: "PENDING",
      },
    });
  }
  console.log(`✓ 注文 ${ORDER_NUMBER} 作成、PENDING 2件`);

  // 集計
  const ds = await prisma.digitalDelivery.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const byStatus: Record<string, number> = {};
  for (const d of ds) byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
  console.log(`\nuser@example.com 納品: ${ds.length} 件 内訳=${JSON.stringify(byStatus)}`);
  console.log("✅ done");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
