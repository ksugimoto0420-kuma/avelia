import { prisma } from "../src/lib/prisma";

async function main() {
  const events = await prisma.event.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, coverImageUrl: true },
    take: 30,
  });
  let withImage = 0;
  let withoutImage = 0;
  for (const e of events) {
    if (e.coverImageUrl) withImage++;
    else withoutImage++;
    console.log(
      `${e.coverImageUrl ? "✓" : "✗"} ${e.title} -- ${e.coverImageUrl ?? "(なし)"}`,
    );
  }
  console.log(`\nwith=${withImage} without=${withoutImage}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
