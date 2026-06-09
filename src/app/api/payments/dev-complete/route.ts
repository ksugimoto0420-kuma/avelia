import { AppError, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/guards";
import { isStripeConfigured } from "@/lib/payment/stripe";
import { markOrderPaid } from "@/lib/order-status";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ orderId: z.string().min(1) });

/**
 * 開発用の疑似決済完了。Stripe 未設定かつ本番以外でのみ有効。
 * Webhook と同等の処理（在庫確定・デジタル付与・メール）を実行する。
 */
export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === "production" || isStripeConfigured()) {
      throw new AppError("この操作は利用できません", 403);
    }
    const user = await requireUser();
    const { orderId } = schema.parse(await req.json());

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== user.id) {
      throw new AppError("注文が見つかりません", 404);
    }

    await markOrderPaid({
      orderId,
      providerPaymentId: `dev_${Date.now()}`,
    });

    return ok({ orderNumber: order.orderNumber });
  } catch (err) {
    return handleError(err);
  }
}
