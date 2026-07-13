import { AppError, handleError, ok } from "@/lib/api";
import { auth } from "@/auth";
import { sendSignatureReadyMail } from "@/lib/mail/sendSignatureReadyMail";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/talent/signatures
 * body: { deliveryId: string, dataUrl: string (data:image/png;base64,...) }
 *
 * タレント用のサインアップロード。TALENT ロールは自分の assignedArtistId
 * 配下のみ書き込み可能。OWNER/MANAGER は全件書き込み可能（テスト・代理用）。
 *
 * #39: タレントが書き終えた瞬間に DigitalDelivery.status = READY まで進め、
 * ファンへ即メール通知する。承認フロー (approveSignature) は運営が代理で
 * 書いたケースの二重チェック用として残す。
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.kind !== "admin") {
      throw new AppError("ログインが必要です", 401);
    }
    const role = session.user.role;
    if (role !== "TALENT" && role !== "OWNER" && role !== "MANAGER") {
      throw new AppError("権限がありません", 403);
    }

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
      throw new AppError("サイン画像が大きすぎます（〜1.5MB）", 413);
    }

    const delivery = await prisma.digitalDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        digitalContent: {
          select: {
            viewLimitDays: true,
            product: { select: { event: { select: { artistId: true } } } },
          },
        },
        order: { select: { orderNumber: true } },
      },
    });
    if (!delivery) throw new AppError("納品が見つかりません", 404);
    if (delivery.status === "READY") {
      throw new AppError("既に納品済みです", 409);
    }

    // TALENT は自分の assignedArtistId 配下のみ書き込み可能
    if (role === "TALENT") {
      const me = await prisma.adminUser.findUnique({
        where: { id: session.user.id },
        select: { assignedArtistId: true, isActive: true },
      });
      if (!me || !me.isActive) {
        throw new AppError("セッションが無効です", 401);
      }
      const deliveryArtistId =
        delivery.digitalContent.product?.event.artistId ?? null;
      if (
        !me.assignedArtistId ||
        me.assignedArtistId !== deliveryArtistId
      ) {
        throw new AppError("このサインを書く権限がありません", 403);
      }
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
      adminUserId: session.user.id,
      action: "talent.signature.upload",
      targetType: "Signature",
      targetId: sig.id,
      detail: { deliveryId, bytes: buffer.byteLength, role },
    });

    // ファンへ即メール通知。送信失敗はレスポンスを止めない (mail 側で吸収)。
    // 非同期で走らせて、次のPENDINGへの遷移を待たせない。
    void sendSignatureReadyMail(deliveryId).catch((err) => {
      console.error("[signature-ready-mail]", err);
    });

    return ok({ id: sig.id });
  } catch (err) {
    return handleError(err);
  }
}
