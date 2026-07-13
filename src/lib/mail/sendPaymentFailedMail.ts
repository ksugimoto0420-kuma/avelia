import { sendMailTemplate } from "@/lib/mail";
import { PaymentFailedMail } from "@/lib/mail/templates/PaymentFailedMail";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/**
 * 決済失敗通知メール (#41) を送信する。
 * Stripe webhook で checkout.session.async_payment_failed を受けたときに呼ぶ。
 *
 * - reservationExpiresAt が未来なら再決済リンク (マイページの注文詳細)
 *   を有効時間付きで案内する。
 * - 過去 (仮確保切れ) の場合は「再注文が必要」の文言のみ表示 (retryUrl は
 *   同じ注文詳細でよい。詳細ページ側で「再注文する」導線が別途あれば流用する)。
 */
export async function sendPaymentFailedMail(
  orderId: string,
  reason?: string | null,
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      reservationExpiresAt: true,
      user: { select: { email: true, name: true } },
    },
  });
  if (!order || !order.user.email) return;

  const retryUrl = `${env.appUrl}/mypage/orders/${order.id}`;

  await sendMailTemplate({
    to: order.user.email,
    subject: `【Avelia FunClub】ご注文 ${order.orderNumber} の決済ができませんでした`,
    template: PaymentFailedMail({
      customerName: order.user.name,
      orderNumber: order.orderNumber,
      reason: humanizeReason(reason),
      retryUrl,
      reservationExpiresAt: order.reservationExpiresAt,
    }),
    idempotencyKey: `payment-failed:${order.id}`,
  });
}

/**
 * Stripe から返ってくる英語の理由 (例: "card_declined") を日本語に整える。
 * 未知のコードはそのまま返す。
 */
function humanizeReason(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const map: Record<string, string> = {
    card_declined: "カード会社側で決済が拒否されました",
    insufficient_funds: "残高不足のため決済できませんでした",
    expired_card: "カードの有効期限が切れています",
    incorrect_cvc: "セキュリティコード (CVC) が正しくありません",
    processing_error: "決済処理で一時的なエラーが発生しました",
    "checkout.session.async_payment_failed":
      "決済処理が完了しませんでした (銀行振込や後払い等の非同期決済失敗)",
    "checkout.session.expired": "決済の有効期限が切れました",
  };
  return map[raw] ?? raw;
}
