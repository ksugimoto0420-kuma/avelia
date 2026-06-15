import { AppError, handleError, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/admin/signatures
 * body: { deliveryId: string, dataUrl: string (data:image/png;base64,...) }
 * 出演者が書いた透過サインPNGを受け取り、Signatureレコードを WRITTEN で作成 or 更新。
 * MVPでは imageData (Bytes) に直接保存。
 */
export async function POST(req: Request) {
  try {
    await requireAdmin("OPERATOR");
    const body = (await req.json()) as {
      deliveryId?: string;
      dataUrl?: string;
    };
    const { deliveryId, dataUrl } = body;
    if (!deliveryId || !dataUrl) {
      throw new AppError("deliveryId と dataUrl は必須です", 400);
    }

    // data URL の "data:image/png;base64,..." から実バイトに変換
    const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!match) throw new AppError("PNG のdata URLを送ってください", 400);
    const buffer = Buffer.from(match[1], "base64");
    if (buffer.byteLength > 1_500_000) {
      // 1.5MB 上限（モック向け、本番ではストレージへ）
      throw new AppError("サイン画像が大きすぎます（〜1.5MB）", 413);
    }

    const delivery = await prisma.digitalDelivery.findUnique({
      where: { id: deliveryId },
      select: { id: true, status: true },
    });
    if (!delivery) throw new AppError("納品が見つかりません", 404);
    if (delivery.status === "READY") {
      throw new AppError("既に納品済みです", 409);
    }

    const sig = await prisma.signature.upsert({
      where: { deliveryId },
      create: {
        deliveryId,
        imageData: buffer,
        status: "WRITTEN",
        writtenAt: new Date(),
      },
      update: {
        imageData: buffer,
        status: "WRITTEN",
        writtenAt: new Date(),
        rejectedAt: null,
        rejectReason: null,
      },
    });

    await logOperation({
      action: "signature.upload",
      targetType: "Signature",
      targetId: sig.id,
      detail: { deliveryId, bytes: buffer.byteLength },
    });

    return ok({ id: sig.id });
  } catch (err) {
    return handleError(err);
  }
}
