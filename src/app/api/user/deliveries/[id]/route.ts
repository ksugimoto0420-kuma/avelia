import path from "node:path";
import { requireUser } from "@/lib/auth/guards";
import { contentTypeFor } from "@/lib/mime";
import { prisma } from "@/lib/prisma";
import { storage, StorageNotFoundError } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * 個別サイン納品の認可付き配信。
 *
 * 配信パターン2種：
 * - fileKey = "signature:<id>" → クライアント合成方式（/mypage/digital-contents/signed/[deliveryId] へリダイレクト）
 * - 通常ファイルキー → ローカルストレージから直接配信
 */
export async function GET(
  req: Request,
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

    // サイン入り合成型：クライアント合成ページへリダイレクト
    if (delivery.fileKey.startsWith("signature:")) {
      const origin = new URL(req.url).origin;
      return Response.redirect(
        `${origin}/mypage/digital-contents/signed/${delivery.id}`,
        302,
      );
    }

    // 通常ファイル配信
    let buffer: Buffer;
    try {
      ({ buffer } = await storage.getFile(delivery.fileKey));
    } catch (e) {
      if (e instanceof StorageNotFoundError) {
        // ファイル実体が消えている／古いシードデータ等で参照先が無いケース。
        // ユーザー側はエラーではなく「準備中」扱いにする方が体験として穏当。
        return new Response(
          "ファイル準備中です。しばらくしてから再度お試しください",
          { status: 403 },
        );
      }
      throw e;
    }
    await prisma.digitalDelivery.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });
    const ext = path.extname(delivery.fileKey) || "";
    const downloadFilename = `${delivery.nickname ?? "signed"}_${delivery.order.orderNumber}${ext}`;
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(delivery.fileKey),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      (err as { status?: number }).status === 401
    ) {
      return new Response("Unauthorized", { status: 401 });
    }
    console.error("[user/deliveries] エラー", err);
    return new Response("エラーが発生しました", { status: 500 });
  }
}
