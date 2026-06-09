import { readFile } from "node:fs/promises";
import path from "node:path";
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

    const buffer = await readFile(localFilePath(delivery.fileKey));
    await prisma.digitalDelivery.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });

    const ext = path.extname(delivery.fileKey) || "";
    const base = `${delivery.nickname ?? "signed"}_${delivery.order.orderNumber}${ext}`;
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(delivery.fileKey),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(base)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
