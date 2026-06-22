/**
 * DigitalContent.baseImageUrl を 4:3 で安定した画像に置き換える。
 * サインキャンバスは aspect-[4/3] なので、原本も同じ比率にすると合成時の
 * 引き伸ばしや余白の歪みが消える。
 *
 * 加えて、特定 deliveryId を指定された場合はサインを未記入 (PENDING) に
 * 戻して、新しい原本で書き直せる状態にする。
 */
import { prisma } from "../src/lib/prisma";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const TAGS = ["portrait", "idol", "studio", "model"];

function urlFor(id: string): string {
  const tag = TAGS[hash(id) % TAGS.length];
  // lock を 10000〜20000 のレンジに振って、今回の問題が出ていた範囲と被らせない
  const lock = 10000 + (hash(id) % 10000);
  return `https://loremflickr.com/1200/900/${tag}?lock=${lock}`;
}

async function main() {
  const contents = await prisma.digitalContent.findMany({
    where: {
      OR: [
        { baseImageUrl: { contains: "loremflickr.com" } },
        { baseImageUrl: { contains: "picsum.photos" } },
        { baseImageUrl: { contains: "placehold.co" } },
      ],
    },
    select: { id: true, title: true },
  });
  console.log(`baseImageUrl 置換対象: ${contents.length} 件`);
  for (const c of contents) {
    const url = urlFor(c.id);
    await prisma.digitalContent.update({
      where: { id: c.id },
      data: { baseImageUrl: url },
    });
    console.log(`  ✓ ${c.title} -> ${url}`);
  }

  // 特定の delivery を「サイン未記入の状態」に戻す（議論対象）
  const targetId = process.argv[2];
  if (targetId) {
    const d = await prisma.digitalDelivery.findUnique({
      where: { id: targetId },
      include: { signature: true },
    });
    if (!d) {
      console.log(`\ndelivery ${targetId} 見つかりません`);
    } else {
      if (d.signature) {
        await prisma.signature.delete({ where: { id: d.signature.id } });
      }
      await prisma.digitalDelivery.update({
        where: { id: targetId },
        data: {
          status: "PENDING",
          fileKey: null,
          originalFilename: null,
          deliveredAt: null,
          expiresAt: null,
          downloadCount: 0,
        },
      });
      console.log(`\n✓ delivery ${targetId} を PENDING に戻し、Signature 削除`);
    }
  }
  console.log("\n✅ done");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
