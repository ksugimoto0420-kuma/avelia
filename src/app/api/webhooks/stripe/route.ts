import type Stripe from "stripe";
import { markOrderPaid, releaseOrder } from "@/lib/order-status";
import { constructWebhookEvent } from "@/lib/payment/stripe";
import { prisma } from "@/lib/prisma";

// 署名検証のため raw body が必要。Node ランタイムで動かす。
export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch (err) {
    console.error("[STRIPE WEBHOOK] 署名検証失敗", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId =
          session.metadata?.orderId ?? session.client_reference_id ?? null;
        if (orderId && session.payment_status === "paid") {
          await markOrderPaid({
            orderId,
            providerSessionId: session.id,
            providerPaymentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : (session.payment_intent?.id ?? null),
            rawEvent: event,
          });
        }
        break;
      }

      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId =
          session.metadata?.orderId ?? session.client_reference_id ?? null;
        if (orderId) {
          await releaseOrder({
            orderId,
            orderStatus:
              event.type === "checkout.session.expired"
                ? "CANCELLED"
                : "FAILED",
            paymentStatus:
              event.type === "checkout.session.expired"
                ? "CANCELLED"
                : "FAILED",
            reason: event.type,
          });
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : (charge.payment_intent?.id ?? null);
        if (paymentIntentId) {
          const payment = await prisma.payment.findFirst({
            where: { providerPaymentId: paymentIntentId },
          });
          if (payment) {
            await prisma.$transaction([
              prisma.payment.update({
                where: { id: payment.id },
                data: { status: "REFUNDED", refundedAt: new Date() },
              }),
              prisma.order.update({
                where: { id: payment.orderId },
                data: { status: "REFUNDED" },
              }),
            ]);
          }
        }
        break;
      }

      default:
        // 未処理イベントは無視（200 を返す）
        break;
    }
  } catch (err) {
    console.error("[STRIPE WEBHOOK] 処理エラー", event.type, err);
    // 5xx を返すと Stripe が再送する
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
