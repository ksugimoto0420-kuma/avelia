/**
 * placehold.co の画像URLを loremflickr に置換する。
 *
 * loremflickr のURL: https://loremflickr.com/<width>/<height>/<tag>?lock=<n>
 *   - lock を id ベースで固定すれば、同じカードは常に同じ画像
 *   - tag は abstract / portrait / city / festival など、確実に
 *     画像が返ってくるメジャーなカテゴリを 1〜2 個に絞る
 */
import { prisma } from "../src/lib/prisma";

const EVENT_TAGS = ["concert", "stage", "neon", "festival", "music"];
const PRODUCT_TAGS = ["product", "merchandise", "card", "poster", "design"];
const ARTIST_TAGS = ["portrait", "studio", "fashion"];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function urlFor(
  id: string,
  width: number,
  height: number,
  tags: string[],
): string {
  const tag = tags[hash(id) % tags.length];
  // lock=0〜10000 のレンジで決定的に固定（同じカードは常に同じ画像）
  const lock = hash(id) % 10000;
  return `https://loremflickr.com/${width}/${height}/${tag}?lock=${lock}`;
}

async function main() {
  console.log("# Event.coverImageUrl");
  const events = await prisma.event.findMany({
    where: {
      OR: [
        { coverImageUrl: { contains: "placehold.co" } },
        { coverImageUrl: { contains: "picsum.photos" } },
      ],
    },
    select: { id: true },
  });
  console.log(`  対象: ${events.length} 件`);
  for (const e of events) {
    await prisma.event.update({
      where: { id: e.id },
      data: { coverImageUrl: urlFor(e.id, 1200, 675, EVENT_TAGS) },
    });
  }
  console.log(`  ✓ done`);

  console.log("\n# Product.imageUrl");
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { imageUrl: { contains: "placehold.co" } },
        { imageUrl: { contains: "picsum.photos" } },
      ],
    },
    select: { id: true },
  });
  console.log(`  対象: ${products.length} 件`);
  for (const p of products) {
    await prisma.product.update({
      where: { id: p.id },
      data: { imageUrl: urlFor(p.id, 800, 800, PRODUCT_TAGS) },
    });
  }
  console.log(`  ✓ done`);

  console.log("\n# Artist.imageUrl");
  const artists = await prisma.artist.findMany({
    where: {
      OR: [
        { imageUrl: { contains: "placehold.co" } },
        { imageUrl: { contains: "picsum.photos" } },
      ],
    },
    select: { id: true },
  });
  console.log(`  対象: ${artists.length} 件`);
  for (const a of artists) {
    await prisma.artist.update({
      where: { id: a.id },
      data: { imageUrl: urlFor(a.id, 600, 600, ARTIST_TAGS) },
    });
  }
  console.log(`  ✓ done`);

  console.log("\n✅ loremflickr に切替完了");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
