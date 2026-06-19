import { prisma } from "../src/lib/prisma";

async function main() {
  const event = await prisma.event.findFirst({
    where: { title: { contains: "STAR PRISM オフィシャルグッズ" } },
    include: {
      products: {
        include: {
          variants: { include: { inventory: true } },
        },
      },
    },
  });
  if (!event) {
    console.log("event が見つかりません");
    return;
  }
  console.log(`Event: ${event.title} (id=${event.id})`);
  for (const p of event.products) {
    console.log(
      `  Product: ${p.name} (id=${p.id}) requiresNickname=${p.requiresNickname}`,
    );
    for (const v of p.variants) {
      console.log(
        `    Variant: ${v.name} (id=${v.id}) price=${v.price} requiresNickname=${v.requiresNickname} qty=${v.inventory?.quantity ?? 0}`,
      );
    }
  }

  // 既存の注文を確認
  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      items: { some: { variant: { product: { eventId: event.id } } } },
    },
    include: { items: { include: { variant: true } } },
  });
  console.log(`\n既存 PAID 注文（このイベント）: ${orders.length} 件`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
