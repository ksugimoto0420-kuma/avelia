import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { localFilePath } from "@/lib/storage";

/**
 * 指定された DigitalDelivery のサイン入り合成済みPNGを生成して返す。
 * 1. サインPNG（Signature.imageData）が必須
 * 2. 原本は baseImageKey → baseImageUrl → product.imageUrl の順でフォールバック
 * 3. サインを原本サイズにリサイズして overlay
 *
 * 戻り値の buffer は PNG。失敗時は null。
 */
export async function generateSignedImage(
  deliveryId: string,
): Promise<Buffer | null> {
  const delivery = await prisma.digitalDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      digitalContent: {
        select: { baseImageKey: true, baseImageUrl: true },
      },
      signature: { select: { imageData: true } },
      orderItem: {
        select: {
          variant: { select: { product: { select: { imageUrl: true } } } },
        },
      },
    },
  });
  if (!delivery?.signature?.imageData) return null;

  // 原本画像を取得
  let originalBuf: Buffer | null = null;
  if (delivery.digitalContent.baseImageUrl) {
    try {
      const res = await fetch(delivery.digitalContent.baseImageUrl);
      if (res.ok) originalBuf = Buffer.from(await res.arrayBuffer());
    } catch {
      originalBuf = null;
    }
  }
  if (!originalBuf && delivery.digitalContent.baseImageKey) {
    try {
      originalBuf = await readFile(
        localFilePath(delivery.digitalContent.baseImageKey),
      );
    } catch {
      originalBuf = null;
    }
  }
  if (!originalBuf) {
    const url = delivery.orderItem.variant.product.imageUrl;
    if (url) {
      try {
        const res = await fetch(url);
        if (res.ok) originalBuf = Buffer.from(await res.arrayBuffer());
      } catch {
        originalBuf = null;
      }
    }
  }
  if (!originalBuf) return null;

  // サインPNGを原本サイズにリサイズ→重ねる
  const meta = await sharp(originalBuf).metadata();
  const sigResized = await sharp(Buffer.from(delivery.signature.imageData))
    .resize({
      width: meta.width,
      height: meta.height,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();
  const composed = await sharp(originalBuf)
    .composite([{ input: sigResized, blend: "over" }])
    .png()
    .toBuffer();
  return composed;
}
