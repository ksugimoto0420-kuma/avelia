import Stripe from "stripe";
import { env } from "@/lib/env";

let _stripe: Stripe | null = null;

/** Stripe クライアント（遅延初期化）。鍵未設定時はエラー。 */
export function getStripe(): Stripe {
  if (!env.stripe.secretKey) {
    throw new Error("STRIPE_SECRET_KEY が未設定です");
  }
  if (!_stripe) {
    _stripe = new Stripe(env.stripe.secretKey, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  const key = env.stripe.secretKey;
  // プレースホルダ（sk_test_xxx 等）は未設定扱いにする
  if (!key || key.includes("xxx")) return false;
  return key.startsWith("sk_");
}

type CheckoutLine = {
  name: string;
  amount: number; // 円（整数）
  quantity: number;
};

/**
 * Stripe Checkout セッションを作成する。
 * client_reference_id / metadata に orderId を入れ、Webhook で突合する。
 */
export async function createCheckoutSession(params: {
  orderId: string;
  orderNumber: string;
  lines: CheckoutLine[];
  shippingFee?: number;
  customerEmail?: string | null;
}) {
  const stripe = getStripe();
  const currency = env.stripe.currency;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    params.lines.map((l) => ({
      quantity: l.quantity,
      price_data: {
        currency,
        unit_amount: l.amount,
        product_data: { name: l.name },
      },
    }));

  if (params.shippingFee && params.shippingFee > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: params.shippingFee,
        product_data: { name: "送料" },
      },
    });
  }

  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    client_reference_id: params.orderId,
    customer_email: params.customerEmail ?? undefined,
    metadata: { orderId: params.orderId, orderNumber: params.orderNumber },
    success_url: `${env.appUrl}/payment/success?order=${params.orderNumber}`,
    cancel_url: `${env.appUrl}/payment/cancel?order=${params.orderNumber}`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });
}

/** Webhook 署名を検証してイベントを返す。 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  const stripe = getStripe();
  if (!env.stripe.webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET が未設定です");
  }
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    env.stripe.webhookSecret,
  );
}
