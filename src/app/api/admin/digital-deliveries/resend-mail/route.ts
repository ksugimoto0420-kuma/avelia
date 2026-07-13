import { AppError, handleError, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { sendSignatureReadyMail } from "@/lib/mail/sendSignatureReadyMail";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/admin/digital-deliveries/resend-mail
 * body: { deliveryId: string }
 *
 * サイン完了通知メールの手動再送。管理者向け。
 * UI 側で確認モーダル → 送信中 → 完了トースト を出せるように、
 * 送信結果 (ok / エラーメッセージ) を JSON で返す。
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin("OPERATOR");
    const body = (await req.json()) as { deliveryId?: string };
    const deliveryId = body.deliveryId;
    if (!deliveryId) throw new AppError("deliveryId が必要です", 400);

    const delivery = await prisma.digitalDelivery.findUnique({
      where: { id: deliveryId },
      select: { status: true, user: { select: { email: true } } },
    });
    if (!delivery) throw new AppError("納品が見つかりません", 404);
    if (delivery.status !== "READY") {
      throw new AppError("納品が完了していません", 409);
    }
    if (!delivery.user.email) {
      throw new AppError("送信先メールアドレスがありません", 400);
    }

    await sendSignatureReadyMail(deliveryId);

    await logOperation({
      adminUserId: admin.id,
      action: "signature.mail.resend",
      targetType: "DigitalDelivery",
      targetId: deliveryId,
    });

    return ok({ sentTo: delivery.user.email });
  } catch (err) {
    return handleError(err);
  }
}
