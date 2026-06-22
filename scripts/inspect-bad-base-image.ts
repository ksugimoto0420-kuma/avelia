import { prisma } from "../src/lib/prisma";

async function main() {
  const id = "cmq66v0c100ebu5sgo1kdg72m";
  const d = await prisma.digitalDelivery.findUnique({
    where: { id },
    include: {
      digitalContent: {
        select: {
          title: true,
          baseImageUrl: true,
          baseImageKey: true,
        },
      },
      orderItem: {
        include: {
          variant: {
            include: {
              product: {
                select: { name: true, imageUrl: true },
              },
            },
          },
        },
      },
      signature: { select: { id: true, status: true, imageData: true } },
    },
  });
  if (!d) {
    console.log("not found");
    return;
  }
  console.log(`delivery=${d.id} status=${d.status}`);
  console.log(`signature: ${d.signature?.status} (size=${d.signature?.imageData?.length ?? 0} bytes)`);
  console.log(`\n=== 原本URLとして使われる候補 ===`);
  console.log(`1. digitalContent.baseImageUrl = ${d.digitalContent.baseImageUrl}`);
  console.log(`2. digitalContent.baseImageKey = ${d.digitalContent.baseImageKey}`);
  console.log(`3. product.imageUrl = ${d.orderItem.variant.product.imageUrl}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
