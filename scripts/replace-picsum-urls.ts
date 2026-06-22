/**
 * デモ用に、picsum.photos の URL を別の安定したダミー画像サービスへ
 * 一括置換する。picsum 側障害でカード画像が表示されない問題への対応。
 *
 * - picsum.photos/seed/<seed>/1200/675 → loremflickr の seed 指定形
 *   https://loremflickr.com/1200/675/<seed>?lock=<hash>
 *   ※ loremflickr も不安定な場合があるため最終的には placehold.co の
 *     色付きプレースホルダーへ。色は seed から決定的に算出して各カードで
 *     違う見た目になるようにする。
 *
 * Event.coverImageUrl と Product.imageUrl の両方を更新する。
 */
import { prisma } from "../src/lib/prisma";

const PALETTE = [
  ["1f2937", "ffffff"], // gray-800
  ["7c3aed", "ffffff"], // purple
  ["db2777", "ffffff"], // brand pink
  ["059669", "ffffff"], // emerald
  ["d97706", "ffffff"], // amber
  ["2563eb", "ffffff"], // blue
  ["dc2626", "ffffff"], // red
  ["0891b2", "ffffff"], // cyan
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function placeholderFor(seed: string, label: string): string {
  const [bg, fg] = PALETTE[hash(seed) % PALETTE.length];
  const enc = encodeURIComponent(label.slice(0, 40));
  return `https://placehold.co/1200x675/${bg}/${fg}.png?text=${enc}`;
}

async function main() {
  console.log("# Event.coverImageUrl");
  const events = await prisma.event.findMany({
    where: { coverImageUrl: { contains: "picsum.photos" } },
    select: { id: true, title: true, coverImageUrl: true },
  });
  console.log(`  対象: ${events.length} 件`);
  for (const e of events) {
    const url = placeholderFor(e.id, e.title);
    await prisma.event.update({
      where: { id: e.id },
      data: { coverImageUrl: url },
    });
  }
  console.log(`  ✓ 置換完了`);

  console.log("\n# Product.imageUrl");
  const products = await prisma.product.findMany({
    where: { imageUrl: { contains: "picsum.photos" } },
    select: { id: true, name: true, imageUrl: true },
  });
  console.log(`  対象: ${products.length} 件`);
  for (const p of products) {
    const url = placeholderFor(p.id, p.name);
    await prisma.product.update({
      where: { id: p.id },
      data: { imageUrl: url },
    });
  }
  console.log(`  ✓ 置換完了`);

  console.log("\n# Artist.imageUrl");
  const artists = await prisma.artist.findMany({
    where: { imageUrl: { contains: "picsum.photos" } },
    select: { id: true, name: true, imageUrl: true },
  });
  console.log(`  対象: ${artists.length} 件`);
  for (const a of artists) {
    const url = placeholderFor(a.id, a.name);
    await prisma.artist.update({
      where: { id: a.id },
      data: { imageUrl: url },
    });
  }
  console.log(`  ✓ 置換完了`);

  console.log("\n✅ 全て done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
