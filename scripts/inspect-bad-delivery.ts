import { prisma } from "../src/lib/prisma";

async function main() {
  const id = "cmq66v0c100ebu5sgo1kdg72m";
  const d = await prisma.digitalDelivery.findUnique({
    where: { id },
    include: {
      digitalContent: { select: { title: true, deliveryType: true, baseImageUrl: true, baseImageKey: true, productId: true } },
      order: { select: { orderNumber: true, userId: true } },
    },
  });
  console.log(JSON.stringify(d, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
