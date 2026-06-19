import { prisma } from "../src/lib/prisma";

async function main() {
  const lotteries = await prisma.lottery.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { title: true } },
      product: { select: { name: true } },
      _count: { select: { entries: true } },
    },
    take: 50,
  });
  console.log(`Lotteries: ${lotteries.length} 件`);
  for (const l of lotteries) {
    console.log(
      `- [${l.status}] ${l.title} | event=${l.event?.title ?? "-"} | product=${l.product?.name ?? "-"} | winners=${l.winnersCount} | entries=${l._count.entries} | entry=${l.entryStartAt.toISOString().slice(0, 10)}~${l.entryEndAt.toISOString().slice(0, 10)} | id=${l.id}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
