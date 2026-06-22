/**
 * user@example.com のカートに「販売中の商品」を複数入れる。
 *
 * 入れる内訳:
 *   1) 星宮みらの「直筆サイン入りミニ色紙」（ニックネーム必須・数量2・未入力）
 *      → このイベントの saleEndAt を 1ヶ月先に延長して "販売中" にする
 *   2) ニックネーム不要の物販（数量1）
 *   3) もう1つ、ニックネーム不要の物販（数量1）
 *
 * 冪等: 既存カートを空にしてから入れ直す。
 *       星宮みらイベントの saleEndAt も毎回未来日で上書き。
 */
import { prisma } from "../src/lib/prisma";

const now = new Date();
const saleWindow = {
  AND: [
    { OR: [{ saleStartAt: null }, { saleStartAt: { lte: now } }] },
    { OR: [{ saleEndAt: null }, { saleEndAt: { gte: now } }] },
  ],
};

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "user@example.com" },
    select: { id: true, email: true },
  });
  if (!user) throw new Error("user@example.com が見つかりません");

  // 0) 星宮みら オンラインサイン会の販売終了日を未来に延長
  const miraEvent = await prisma.event.findFirst({
    where: { title: { contains: "星宮みら オンラインサイン会" } },
    select: { id: true, title: true, saleEndAt: true },
  });
  if (miraEvent) {
    const newEnd = new Date(now);
    newEnd.setMonth(newEnd.getMonth() + 1);
    await prisma.event.update({
      where: { id: miraEvent.id },
      data: { saleEndAt: newEnd, isPublished: true },
    });
    console.log(
      `イベント "${miraEvent.title}" の saleEndAt を ${newEnd.toISOString().slice(0, 10)} に更新`,
    );
  }

  // 1) ニックネーム必須かつ販売中の variant（星宮みらが優先で取れるはず）
  const nicknameVariant = await prisma.productVariant.findFirst({
    where: {
      requiresNickname: true,
      product: {
        // 星宮みらの色紙を可能なら最優先
        name: { contains: "直筆サイン入りミニ色紙" },
        event: {
          title: { contains: "星宮みら" },
          isPublished: true,
          ...saleWindow,
        },
      },
    },
    include: { product: { include: { event: { select: { title: true, saleEndAt: true } } } } },
  });
  // フォールバック: 星宮みらが取れない場合は販売中の何でも
  const fallback = nicknameVariant
    ? null
    : await prisma.productVariant.findFirst({
        where: {
          requiresNickname: true,
          product: {
            isPublished: true,
            event: { isPublished: true, ...saleWindow },
          },
        },
        include: { product: { include: { event: { select: { title: true, saleEndAt: true } } } } },
      });
  const nickV = nicknameVariant ?? fallback;
  if (!nickV)
    throw new Error("販売中のニックネーム必須バリアントが見つかりません");

  // 2) ニックネーム不要・物販・販売中（別 product）
  const goods1 = await prisma.productVariant.findFirst({
    where: {
      requiresNickname: false,
      product: {
        id: { not: nickV.productId },
        type: "PHYSICAL",
        isPublished: true,
        event: { isPublished: true, ...saleWindow },
      },
    },
    include: { product: { include: { event: { select: { title: true, saleEndAt: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  // 3) もう1つ
  const goods2 = await prisma.productVariant.findFirst({
    where: {
      requiresNickname: false,
      product: {
        id: { notIn: [nickV.productId, ...(goods1 ? [goods1.productId] : [])] },
        type: "PHYSICAL",
        isPublished: true,
        event: { isPublished: true, ...saleWindow },
      },
    },
    include: { product: { include: { event: { select: { title: true, saleEndAt: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const cart = await prisma.cart.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
    select: { id: true },
  });
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      variantId: nickV.id,
      quantity: 2,
      unitNicknames: [],
    },
  });
  if (goods1)
    await prisma.cartItem.create({
      data: { cartId: cart.id, variantId: goods1.id, quantity: 1 },
    });
  if (goods2)
    await prisma.cartItem.create({
      data: { cartId: cart.id, variantId: goods2.id, quantity: 1 },
    });

  const after = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    include: {
      variant: {
        include: {
          product: {
            select: {
              name: true,
              requiresNickname: true,
              event: { select: { title: true, saleEndAt: true } },
            },
          },
        },
      },
    },
  });
  console.log(`${user.email} のカート: ${after.length} 件`);
  for (const i of after) {
    const end = i.variant.product.event.saleEndAt?.toISOString().slice(0, 10);
    console.log(
      `  - ${i.variant.product.name} (${i.variant.name}) x${i.quantity} 必須=${i.variant.product.requiresNickname} 販売終了=${end} [${i.variant.product.event.title}]`,
    );
  }
  console.log("✅ done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
