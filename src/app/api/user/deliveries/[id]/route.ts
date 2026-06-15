import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/auth/guards";
import { contentTypeFor } from "@/lib/mime";
import { prisma } from "@/lib/prisma";
import { generateSignedImage } from "@/lib/signed-image";
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
        digitalContent: { select: { downloadLimit: true } },
        order: { select: { orderNumber: true } },
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
      const composed = await generateSignedImage(id);
      if (!composed) {
        return new Response("サイン入り画像を生成できません", { status: 500 });
      }
      buffer = composed;
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
  } catch (err) {
    // AuthError は401、それ以外は本物の500（ログは残す）
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      (err as { status?: number }).status === 401
    ) {
      return new Response("Unauthorized", { status: 401 });
    }
    console.error("[user/deliveries] 配信処理エラー", err);
    return new Response("配信処理でエラーが発生しました", { status: 500 });
  }
}
