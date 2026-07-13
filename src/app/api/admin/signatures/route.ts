import { AppError, handleError, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { sendSignatureReadyMail } from "@/lib/mail/sendSignatureReadyMail";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/admin/signatures
 * body: { deliveryId: string, dataUrl: string (data:image/png;base64,...) }
 *
 * 管理画面のサイン記入セッションで運営が代理で書いたサインを受け取り、
 * その場で DigitalDelivery.status = READY まで進めてファンに即メール送信する。
 *
 * 本番仕様 (#39 に合わせて統一): タレント経由 (/api/talent/signatures) と
 * 挙動を揃え、送信=納品完了+即メール。承認ステップは廃止。
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin("OPERATOR");
    const body = (await req.json()) as {
      deliveryId?: string;
      dataUrl?: string;
    };
    const { deliveryId, dataUrl } = body;
    if (!deliveryId || !dataUrl) {
      throw new AppError("deliveryId と dataUrl は必須です", 400);
    }

    const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!match) throw new AppError("PNG のdata URLを送ってください", 400);
    const buffer = Buffer.from(match[1], "base64");
    if (buffer.byteLength > 1_500_000) {
      // 1.5MB 上限（モック向け、本番ではストレージへ）
      throw new AppError("サイン画像が大きすぎます（〜1.5MB）", 413);
    }

    const delivery = await prisma.digitalDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        digitalContent: { select: { viewLimitDays: true } },
        order: { select: { orderNumber: true } },
      },
    });
    if (!delivery) throw new AppError("納品が見つかりません", 404);
    if (delivery.status === "READY") {
      throw new AppError("既に納品済みです", 409);
    }

    const now = new Date();
    const expiresAt = delivery.digitalContent.viewLimitDays
      ? new Date(
          now.getTime() +
            delivery.digitalContent.viewLimitDays * 24 * 60 * 60 * 1000,
        )
      : null;

    const [sig] = await prisma.$transaction(async (tx) => {
      const sig = await tx.signature.upsert({
        where: { deliveryId },
        create: {
          deliveryId,
          imageData: buffer,
          status: "COMPLETED",
          writtenAt: now,
          composedAt: now,
        },
        update: {
          imageData: buffer,
          status: "COMPLETED",
          writtenAt: now,
          composedAt: now,
          rejectedAt: null,
          rejectReason: null,
        },
      });
      const fileKey = `signature:${sig.id}`;
      await tx.digitalDelivery.update({
        where: { id: deliveryId },
        data: {
          fileKey,
          originalFilename: `${delivery.order.orderNumber}_${delivery.nickname ?? "宛名なし"}.png`,
          status: "READY",
          deliveredAt: now,
          expiresAt,
          downloadCount: 0,
        },
      });
      return [sig] as const;
    });

    await logOperation({
      adminUserId: admin.id,
      action: "signature.upload",
      targetType: "Signature",
      targetId: sig.id,
      detail: { deliveryId, bytes: buffer.byteLength },
    });

    // ファンへ即メール通知。レスポンスは待たず、失敗はログのみ (mail 側で吸収)。
    void sendSignatureReadyMail(deliveryId).catch((err) => {
      console.error("[signature-ready-mail]", err);
    });

    return ok({ id: sig.id });
  } catch (err) {
    return handleError(err);
  }
}
