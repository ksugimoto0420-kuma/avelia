import { prisma } from "../src/lib/prisma";

async function main() {
  const now = new Date();
  // 1) 販売中で、ニックネーム必須のバリアントを探す
  const onSale = await prisma.productVariant.findMany({
    where: {
      requiresNickname: true,
      product: {
        isPublished: true,
        event: {
          isPublished: true,
          AND: [
            { OR: [{ saleStartAt: null }, { saleStartAt: { lte: now } }] },
            { OR: [{ saleEndAt: null }, { saleEndAt: { gte: now } }] },
          ],
        },
      },
    },
    take: 10,
    include: {
      product: {
        include: {
          event: {
            select: { title: true, saleStartAt: true, saleEndAt: true },
          },
        },
      },
    },
  });
  console.log(`販売中のニックネーム必須バリアント: ${onSale.length} 件`);
  for (const v of onSale) {
    console.log(
      `  - ${v.product.event.title} / ${v.product.name} / ${v.name} (sale=${v.product.event.saleStartAt?.toISOString().slice(0, 10)}〜${v.product.event.saleEndAt?.toISOString().slice(0, 10)})`,
    );
  }

  // 2) 元々入れた「星宮みら」関係の販売状況
  const miramaちan = await prisma.product.findFirst({
    where: {
      name: { contains: "直筆サイン入りミニ色紙" },
      event: { title: { contains: "星宮みら" } },
    },
    include: {
      event: { select: { id: true, title: true, isPublished: true, saleStartAt: true, saleEndAt: true } },
    },
  });
  if (miramaちan) {
    console.log("\n星宮みらの直筆サイン入りミニ色紙の状況:");
    console.log(
      `  event=${miramaちan.event.title} sale=${miramaちan.event.saleStartAt?.toISOString().slice(0, 10)}〜${miramaちan.event.saleEndAt?.toISOString().slice(0, 10)} published=${miramaちan.event.isPublished}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
