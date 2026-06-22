/**
 * loremflickr の lock 値範囲を 20000〜30000 にずらして、これまでに「赤い画像」
 * が出ていた lock 値とは別の画像を引かせる。タグも多様化して、変な画像が
 * 偶発的に重ならないようにする。
 *
 * 対象:
 *   - Event.coverImageUrl
 *   - Product.imageUrl
 *   - Artist.imageUrl
 *
 * 既存 URL が loremflickr.com を含むものを置換。
 */
import { prisma } from "../src/lib/prisma";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const EVENT_TAGS = ["concert", "stage", "lights", "festival", "venue"];
const PRODUCT_TAGS = ["merchandise", "design", "studio", "package", "art"];
const ARTIST_TAGS = ["portrait", "model", "fashion"];

function urlFor(
  id: string,
  width: number,
  height: number,
  tags: string[],
): string {
  const tag = tags[hash(id) % tags.length];
  // lock を 20000〜30000 のレンジに振り直す
  const lock = 20000 + (hash(id) % 10000);
  return `https://loremflickr.com/${width}/${height}/${tag}?lock=${lock}`;
}

async function main() {
  console.log("# Event.coverImageUrl");
  const events = await prisma.event.findMany({
    where: { coverImageUrl: { contains: "loremflickr.com" } },
    select: { id: true },
  });
  console.log(`  対象: ${events.length} 件`);
  for (const e of events) {
    await prisma.event.update({
      where: { id: e.id },
      data: { coverImageUrl: urlFor(e.id, 1200, 675, EVENT_TAGS) },
    });
  }
  console.log("  ✓ done");

  console.log("\n# Product.imageUrl");
  const products = await prisma.product.findMany({
    where: { imageUrl: { contains: "loremflickr.com" } },
    select: { id: true },
  });
  console.log(`  対象: ${products.length} 件`);
  for (const p of products) {
    await prisma.product.update({
      where: { id: p.id },
      data: { imageUrl: urlFor(p.id, 800, 800, PRODUCT_TAGS) },
    });
  }
  console.log("  ✓ done");

  console.log("\n# Artist.imageUrl");
  const artists = await prisma.artist.findMany({
    where: { imageUrl: { contains: "loremflickr.com" } },
    select: { id: true },
  });
  console.log(`  対象: ${artists.length} 件`);
  for (const a of artists) {
    await prisma.artist.update({
      where: { id: a.id },
      data: { imageUrl: urlFor(a.id, 600, 600, ARTIST_TAGS) },
    });
  }
  console.log("  ✓ done");

  // 参考: 該当の問題商品の新URLを表示
  const target = await prisma.product.findUnique({
    where: { id: "97c3d4bf-6ea2-488a-bd95-e76ddd072c83" },
    select: { name: true, imageUrl: true },
  });
  if (target) {
    console.log(`\n問題商品「${target.name}」の新URL:\n  ${target.imageUrl}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
