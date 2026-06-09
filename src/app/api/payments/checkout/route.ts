import { AppError, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/guards";
import { createCheckoutSession, isStripeConfigured } from "@/lib/payment/stripe";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ orderId: z.string().min(1) });

/**
 * PENDING 注文に対する決済セッションを開始する。
 * Stripe 未設定（ローカル）の場合は devMode を返し、開発用完了APIで疑似決済できる。
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { orderId } = schema.parse(await req.json());

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.userId !== user.id) {
      throw new AppError("注文が見つかりません", 404);
    }
    if (order.status !== "PENDING") {
      throw new AppError("この注文は決済できません", 409);
    }

    if (!isStripeConfigured()) {
      // ローカル開発：疑似決済へ
      return ok({ devMode: true, orderId: order.id, orderNumber: order.orderNumber });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true },
    });

    const session = await createCheckoutSession({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerEmail: dbUser?.email,
      shippingFee: order.shippingFee,
      lines: order.items.map((i) => ({
        name: `${i.productName}（${i.variantName}）`,
        amount: i.unitPrice,
        quantity: i.quantity,
      })),
    });

    // セッションIDを記録
    await prisma.payment.update({
      where: { orderId: order.id },
      data: { providerSessionId: session.id, status: "PENDING" },
    });

    return ok({ url: session.url });
  } catch (err) {
    return handleError(err);
  }
}
