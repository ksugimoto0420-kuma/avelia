import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { requireUser } from "@/lib/auth/guards";
import { contentTypeFor } from "@/lib/mime";
import { prisma } from "@/lib/prisma";
import { localFilePath } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * 個別サイン納品の認可付き配信。ログインユーザー本人の READY 納品のみDL可。
 * ファイル名は宛名ベース。期限・DL回数も検証する（仕様書 8/15）。
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const delivery = await prisma.digitalDelivery.findUnique({
      where: { id },
      include: {
        digitalContent: {
          select: {
            downloadLimit: true,
            baseImageKey: true,
            baseImageUrl: true,
            productId: true,
          },
        },
        order: { select: { orderNumber: true } },
        signature: { select: { id: true, imageData: true } },
        orderItem: {
          select: {
            variant: { select: { product: { select: { imageUrl: true } } } },
          },
        },
      },
    });
    if (!delivery || delivery.userId !== user.id) {
      return new Response("Not found", { status: 404 });
    }
    if (delivery.status !== "READY" || !delivery.fileKey) {
      return new Response("準備中です", { status: 403 });
    }
    const now = new Date();
    if (delivery.expiresAt && delivery.expiresAt < now) {
      return new Response("閲覧期限が切れています", { status: 403 });
    }
    const limit = delivery.digitalContent.downloadLimit;
    if (limit != null && delivery.downloadCount >= limit) {
      return new Response("ダウンロード回数の上限に達しています", {
        status: 403,
      });
    }

    // ---------- 配信ロジック分岐 ----------
    // (A) fileKey が "signature:<sigId>" → 原本+サインをサーバー側で合成して返す（モック）
    // (B) 通常のローカルファイル
    let buffer: Buffer;
    let contentType: string;
    let downloadFilename: string;

    if (delivery.fileKey.startsWith("signature:")) {
      if (!delivery.signature?.imageData) {
        return new Response("サイン画像が見つかりません", { status: 404 });
      }
      // 原本画像を取得：
      // 1. baseImageKey（ローカルストレージ）
      // 2. baseImageUrl（外部CDN、モック向け）
      // 3. orderItem.variant.product.imageUrl（最終フォールバック）
      let originalBuf: Buffer | null = null;
      if (delivery.digitalContent.baseImageKey) {
        try {
          originalBuf = await readFile(
            localFilePath(delivery.digitalContent.baseImageKey),
          );
        } catch {
          originalBuf = null;
        }
      }
      if (!originalBuf && delivery.digitalContent.baseImageUrl) {
        try {
          const res = await fetch(delivery.digitalContent.baseImageUrl);
          if (res.ok) originalBuf = Buffer.from(await res.arrayBuffer());
        } catch {
          originalBuf = null;
        }
      }
      if (!originalBuf) {
        const url = delivery.orderItem.variant.product.imageUrl;
        if (url) {
          const res = await fetch(url);
          if (res.ok) {
            originalBuf = Buffer.from(await res.arrayBuffer());
          }
        }
      }
      if (!originalBuf) {
        return new Response("原本画像が取得できません", { status: 500 });
      }

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
      buffer = await sharp(originalBuf)
        .composite([{ input: sigResized, blend: "over" }])
        .png()
        .toBuffer();
      contentType = "image/png";
      downloadFilename = `${delivery.nickname ?? "signed"}_${delivery.order.orderNumber}.png`;
    } else {
      buffer = await readFile(localFilePath(delivery.fileKey));
      contentType = contentTypeFor(delivery.fileKey);
      const ext = path.extname(delivery.fileKey) || "";
      downloadFilename = `${delivery.nickname ?? "signed"}_${delivery.order.orderNumber}${ext}`;
    }

    await prisma.digitalDelivery.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
