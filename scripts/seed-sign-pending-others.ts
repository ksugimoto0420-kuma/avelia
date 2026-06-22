/**
 * 他ユーザー (fan0X@example.com 系) からも PERSONALIZED の注文を作って
 * サイン納品一覧に複数人分の PENDING が並ぶ状態にする。
 * デモでは「サインを書く側」の体験を見せるのが目的なので、購入者は誰でも良い。
 */
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";

const ORDERS = [
  { suffix: "C", userIdx: 1, nicknames: [{ nickname: "ことね", nicknameKana: "コトネ" }] },
  { suffix: "D", userIdx: 2, nicknames: [{ nickname: "ひな", nicknameKana: "ヒナ" }, { nickname: "みおん", nicknameKana: "ミオン" }] },
  { suffix: "E", userIdx: 3, nicknames: [{ nickname: "らら", nicknameKana: "ララ" }] },
];

async function main() {
  // PERSONALIZED コンテンツを全て取り出す。多様性を出すため、ContentごとにユーザーをローテしてOrderを作る
  const contents = await prisma.digitalContent.findMany({
    where: {
      deliveryType: "PERSONALIZED",
      product: { isPublished: true, event: { isPublished: true } },
    },
    include: {
      product: {
        include: { variants: { include: { inventory: true } } },
      },
    },
  });
  if (contents.length === 0) throw new Error("PERSONALIZED コンテンツなし");

  const users = await prisma.user.findMany({
    where: {
      email: { endsWith: "@example.com", not: "user@example.com" },
    },
    take: 5,
    select: { id: true, email: true, name: true },
  });
  if (users.length === 0) throw new Error("他のユーザーが見つかりません");

  for (const o of ORDERS) {
    const orderNumber = `AV-DEMO-SIGN-${o.suffix}`;
    const user = users[o.userIdx % users.length];
    // Content は順番にローテ
    const c = contents[o.userIdx % contents.length];
    const variant = c.product!.variants[0];
    if (!variant) continue;

    // 既存を消す（冪等）
    const existing = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true },
    });
    if (existing) {
      await prisma.signature.deleteMany({
        where: { delivery: { orderId: existing.id } },
      });
      await prisma.digitalDelivery.deleteMany({ where: { orderId: existing.id } });
      await prisma.payment.deleteMany({ where: { orderId: existing.id } });
      await prisma.orderItem.deleteMany({ where: { orderId: existing.id } });
      await prisma.order.delete({ where: { id: existing.id } });
    }

    const qty = o.nicknames.length;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: user.id,
        status: "PAID",
        subtotal: variant.price * qty,
        shippingFee: 0,
        total: variant.price * qty,
        paidAt: new Date(),
        recipientName: user.name ?? "テスト購入者",
        items: {
          create: [
            {
              variantId: variant.id,
              productName: c.product!.name,
              variantName: variant.name,
              unitPrice: variant.price,
              quantity: qty,
              nickname: o.nicknames[0].nickname,
              nicknameKana: o.nicknames[0].nicknameKana,
              unitNicknames: o.nicknames.map((n) => ({ ...n, note: null })),
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
          digitalContentId: c.id,
          orderId: order.id,
          orderItemId: item.id,
          userId: user.id,
          unitIndex: i,
          nickname: o.nicknames[i].nickname,
          nicknameKana: o.nicknames[i].nicknameKana,
          status: "PENDING",
        },
      });
    }
    console.log(
      `✓ ${orderNumber} user=${user.email} content="${c.title}" qty=${qty}`,
    );
  }

  const pendingCount = await prisma.digitalDelivery.count({
    where: { status: "PENDING" },
  });
  const readyCount = await prisma.digitalDelivery.count({
    where: { status: "READY" },
  });
  console.log(`\n全体: PENDING=${pendingCount} READY=${readyCount}`);
  console.log("✅ done");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
