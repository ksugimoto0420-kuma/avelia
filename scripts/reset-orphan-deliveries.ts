/**
 * デモ用クリーンアップ:
 * デジタルサイン機能の実装前にシード or 手動で作られた "中身のないREADY" 納品を
 * PENDING に戻す。署名画像が手元に無いため READY のまま放置すると、
 * /api/user/deliveries/<id> がローカルストレージ参照で 500 を返してしまう。
 *
 * 対象: status=READY だが fileKey が seed-* で始まる、または signature: でも
 *       それ以外の "実体不明" の納品。
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const argId = process.argv[2];

  if (argId) {
    // 個別指定モード
    const d = await prisma.digitalDelivery.findUnique({ where: { id: argId } });
    if (!d) {
      console.log(`delivery ${argId} not found`);
      return;
    }
    console.log("before:", {
      id: d.id,
      status: d.status,
      fileKey: d.fileKey,
      deliveredAt: d.deliveredAt,
    });
    await prisma.digitalDelivery.update({
      where: { id: argId },
      data: {
        status: "PENDING",
        fileKey: null,
        originalFilename: null,
        deliveredAt: null,
        expiresAt: null,
        downloadCount: 0,
      },
    });
    await prisma.signature.deleteMany({ where: { deliveryId: argId } });
    const after = await prisma.digitalDelivery.findUnique({
      where: { id: argId },
    });
    console.log("after:", {
      id: after?.id,
      status: after?.status,
      fileKey: after?.fileKey,
    });
    return;
  }

  // 全件モード: seed- プレフィックスを持つ READY を PENDING に戻す
  const targets = await prisma.digitalDelivery.findMany({
    where: {
      status: "READY",
      fileKey: { startsWith: "seed-" },
    },
    select: { id: true, fileKey: true, nickname: true, orderId: true },
  });

  console.log(`Found ${targets.length} stale READY deliveries`);
  for (const t of targets) {
    console.log(
      `  - id=${t.id} fileKey=${t.fileKey} nickname=${t.nickname} order=${t.orderId}`,
    );
  }
  if (targets.length === 0) return;

  const ids = targets.map((t) => t.id);
  await prisma.digitalDelivery.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "PENDING",
      fileKey: null,
      originalFilename: null,
      deliveredAt: null,
      expiresAt: null,
      downloadCount: 0,
    },
  });
  await prisma.signature.deleteMany({
    where: { deliveryId: { in: ids } },
  });
  console.log(`Reset ${targets.length} deliveries to PENDING`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
