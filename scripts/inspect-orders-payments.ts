import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== Order status counts ===");
  const orderCounts = await prisma.order.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  for (const c of orderCounts) console.log(`  ${c.status}: ${c._count._all}`);

  console.log("\n=== Payment status counts ===");
  const payCounts = await prisma.payment.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  for (const c of payCounts) console.log(`  ${c.status}: ${c._count._all}`);

  console.log("\n=== Sample PAID order (流用元) ===");
  const sample = await prisma.order.findFirst({
    where: { status: "PAID" },
    include: {
      items: { include: { variant: { include: { product: true } } } },
      payment: true,
      user: { select: { email: true } },
    },
  });
  if (sample) {
    console.log(`  orderId=${sample.id} number=${sample.orderNumber} user=${sample.user.email} total=${sample.total}`);
    console.log(`  items=${sample.items.length}`);
    console.log(`  payment status=${sample.payment?.status}`);
  } else {
    console.log("  なし");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
