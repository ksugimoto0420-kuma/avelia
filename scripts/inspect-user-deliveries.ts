import { prisma } from "../src/lib/prisma";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "user@example.com" },
    select: { id: true },
  });
  if (!user) throw new Error("no user");

  const ds = await prisma.digitalDelivery.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      digitalContent: {
        select: {
          title: true,
          deliveryType: true,
          product: { select: { name: true, event: { select: { title: true, artistId: true, artistName: true } } } },
        },
      },
      orderItem: { select: { quantity: true } },
      order: { select: { orderNumber: true } },
      signature: { select: { status: true } },
    },
  });
  console.log(`user@example.com の納品: ${ds.length} 件`);
  for (const d of ds) {
    console.log(
      `  [${d.status}] sig=${d.signature?.status ?? "-"} ${d.digitalContent.title} 宛=${d.nickname} ${d.digitalContent.product?.event?.title ?? "-"} order=${d.order.orderNumber}`,
    );
  }

  // PERSONALIZED 配信のあるコンテンツ
  console.log("\nPERSONALIZED デジタルコンテンツ:");
  const contents = await prisma.digitalContent.findMany({
    where: { deliveryType: "PERSONALIZED" },
    take: 10,
    include: {
      product: {
        select: { id: true, name: true, event: { select: { title: true, isPublished: true, artistId: true } } },
      },
    },
  });
  for (const c of contents) {
    console.log(`  - ${c.title} / product=${c.product?.name ?? "-"} / event=${c.product?.event?.title ?? "-"} (published=${c.product?.event?.isPublished})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
