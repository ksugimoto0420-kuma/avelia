/**
 * placehold.co に置換した画像URLを picsum.photos に戻す。
 * seed は id をそのまま使い、決定的に同じ画像を返す。
 */
import { prisma } from "../src/lib/prisma";

function picsumFor(id: string): string {
  // id をそのまま seed に。長すぎないよう先頭 24 文字に絞る
  const seed = id.slice(0, 24);
  return `https://picsum.photos/seed/${seed}/1200/675`;
}

async function main() {
  console.log("# Event.coverImageUrl");
  const events = await prisma.event.findMany({
    where: { coverImageUrl: { contains: "placehold.co" } },
    select: { id: true, title: true },
  });
  console.log(`  対象: ${events.length} 件`);
  for (const e of events) {
    await prisma.event.update({
      where: { id: e.id },
      data: { coverImageUrl: picsumFor(e.id) },
    });
  }
  console.log("  ✓ done");

  console.log("\n# Product.imageUrl");
  const products = await prisma.product.findMany({
    where: { imageUrl: { contains: "placehold.co" } },
    select: { id: true, name: true },
  });
  console.log(`  対象: ${products.length} 件`);
  for (const p of products) {
    await prisma.product.update({
      where: { id: p.id },
      data: { imageUrl: picsumFor(p.id) },
    });
  }
  console.log("  ✓ done");

  console.log("\n# Artist.imageUrl");
  const artists = await prisma.artist.findMany({
    where: { imageUrl: { contains: "placehold.co" } },
    select: { id: true, name: true },
  });
  console.log(`  対象: ${artists.length} 件`);
  for (const a of artists) {
    await prisma.artist.update({
      where: { id: a.id },
      data: { imageUrl: picsumFor(a.id) },
    });
  }
  console.log("  ✓ done");

  console.log("\n✅ 全て picsum.photos に復元完了");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
