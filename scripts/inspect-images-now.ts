import { prisma } from "../src/lib/prisma";

async function main() {
  const events = await prisma.event.findMany({
    where: { isPublished: true },
    take: 5,
    select: { id: true, title: true, coverImageUrl: true },
  });
  console.log("Event sample:");
  for (const e of events) console.log(`  ${e.title} -> ${e.coverImageUrl}`);

  const products = await prisma.product.findMany({
    where: {
      isPublished: true,
      event: { isPublished: true },
    },
    take: 5,
    select: { id: true, name: true, imageUrl: true },
  });
  console.log("\nProduct sample:");
  for (const p of products) console.log(`  ${p.name} -> ${p.imageUrl}`);

  // 残っている picsum URL は?
  const remainEvents = await prisma.event.count({
    where: { coverImageUrl: { contains: "picsum" } },
  });
  const remainProducts = await prisma.product.count({
    where: { imageUrl: { contains: "picsum" } },
  });
  console.log(`\npicsum 残: events=${remainEvents}, products=${remainProducts}`);

  // null の比率
  const nullEvents = await prisma.event.count({
    where: { coverImageUrl: null },
  });
  const nullProducts = await prisma.product.count({
    where: { imageUrl: null },
  });
  console.log(`null: events=${nullEvents}, products=${nullProducts}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
