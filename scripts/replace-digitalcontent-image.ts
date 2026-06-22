import { prisma } from "../src/lib/prisma";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const TAGS = ["portrait", "idol", "poster", "design"];

function urlFor(id: string): string {
  const tag = TAGS[hash(id) % TAGS.length];
  const lock = hash(id) % 10000;
  return `https://loremflickr.com/1200/1500/${tag}?lock=${lock}`;
}

async function main() {
  const targets = await prisma.digitalContent.findMany({
    where: {
      OR: [
        { baseImageUrl: { contains: "picsum.photos" } },
        { baseImageUrl: { contains: "placehold.co" } },
      ],
    },
    select: { id: true, title: true },
  });
  console.log(`対象: ${targets.length} 件`);
  for (const t of targets) {
    await prisma.digitalContent.update({
      where: { id: t.id },
      data: { baseImageUrl: urlFor(t.id) },
    });
  }
  console.log("✅ 完了");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
