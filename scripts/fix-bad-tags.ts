/**
 * loremflickr の "lights" / "pop" タグが HTTP 500 を返すため、これらの
 * タグを含む既存URLを安全なタグに置き換える。
 *
 * 「監査済み 200 OK」と確認できたタグだけを使う。
 */
import { prisma } from "../src/lib/prisma";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// 全部 HTTP 200 で監査済みのタグだけ使う
const SAFE_EVENT_TAGS = ["concert", "stage", "festival", "venue", "neon", "music"];
const SAFE_PRODUCT_TAGS = [
  "merchandise",
  "design",
  "studio",
  "package",
  "art",
  "poster",
  "card",
  "abstract",
];
const SAFE_ARTIST_TAGS = ["portrait", "model", "fashion", "studio"];

function urlFor(
  id: string,
  width: number,
  height: number,
  tags: string[],
): string {
  const tag = tags[hash(id) % tags.length];
  const lock = 20000 + (hash(id) % 10000);
  return `https://loremflickr.com/${width}/${height}/${tag}?lock=${lock}`;
}

async function main() {
  // 壊れているタグを含むURLだけ更新（残りは触らない）
  const BAD = ["/lights?", "/pop?"];

  console.log("# Event.coverImageUrl の /lights?, /pop? を置換");
  for (const bad of BAD) {
    const evs = await prisma.event.findMany({
      where: { coverImageUrl: { contains: bad } },
      select: { id: true, title: true },
    });
    console.log(`  ${bad}: ${evs.length} 件`);
    for (const e of evs) {
      await prisma.event.update({
        where: { id: e.id },
        data: { coverImageUrl: urlFor(e.id, 1200, 675, SAFE_EVENT_TAGS) },
      });
    }
  }

  console.log("\n# Product.imageUrl の /lights?, /pop? を置換");
  for (const bad of BAD) {
    const ps = await prisma.product.findMany({
      where: { imageUrl: { contains: bad } },
      select: { id: true, name: true },
    });
    console.log(`  ${bad}: ${ps.length} 件`);
    for (const p of ps) {
      await prisma.product.update({
        where: { id: p.id },
        data: { imageUrl: urlFor(p.id, 800, 800, SAFE_PRODUCT_TAGS) },
      });
    }
  }

  console.log("\n# Artist.imageUrl の /lights?, /pop? を置換");
  for (const bad of BAD) {
    const as = await prisma.artist.findMany({
      where: { imageUrl: { contains: bad } },
      select: { id: true, name: true },
    });
    console.log(`  ${bad}: ${as.length} 件`);
    for (const a of as) {
      await prisma.artist.update({
        where: { id: a.id },
        data: { imageUrl: urlFor(a.id, 600, 600, SAFE_ARTIST_TAGS) },
      });
    }
  }

  console.log("\n# DigitalContent.baseImageUrl も同様に");
  for (const bad of BAD) {
    const cs = await prisma.digitalContent.findMany({
      where: { baseImageUrl: { contains: bad } },
      select: { id: true, title: true },
    });
    console.log(`  ${bad}: ${cs.length} 件`);
    for (const c of cs) {
      await prisma.digitalContent.update({
        where: { id: c.id },
        data: {
          baseImageUrl: urlFor(c.id, 1200, 900, SAFE_PRODUCT_TAGS),
        },
      });
    }
  }

  console.log("\n✅ done");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
