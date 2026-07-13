import { sendMailTemplate } from "@/lib/mail";
import { ShippedMail } from "@/lib/mail/templates/ShippedMail";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/**
 * 配送会社名から公開追跡URLを組み立てる。
 * よく使われる 3 社 (ヤマト / 佐川 / 日本郵便) をマッピング。
 * 未対応の会社は null を返し、テンプレートは追跡URLを非表示にする。
 */
export function carrierTrackingUrl(
  carrier: string | null,
  trackingNumber: string | null,
): string | null {
  if (!carrier || !trackingNumber) return null;
  const c = carrier.trim();
  const t = encodeURIComponent(trackingNumber.trim());
  if (/ヤマト|クロネコ|yamato/i.test(c)) {
    return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number01=${t}`;
  }
  if (/佐川|sagawa/i.test(c)) {
    return `https://k2k.sagawa-exp.co.jp/p/web/okurijoinput.do?okurijoNo=${t}`;
  }
  if (/日本郵便|ゆうパック|japan\s*post/i.test(c)) {
    return `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${t}&locale=ja`;
  }
  return null;
}

/**
 * 発送完了メール (#40) を送信する。
 * Shipment が SHIPPED に遷移した瞬間に呼ぶ。
 */
export async function sendShippedMail(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { email: true, name: true } },
      shipment: {
        select: {
          carrier: true,
          trackingNumber: true,
        },
      },
    },
  });
  if (!order || !order.user.email) return;

  const trackingUrl = carrierTrackingUrl(
    order.shipment?.carrier ?? null,
    order.shipment?.trackingNumber ?? null,
  );

  await sendMailTemplate({
    to: order.user.email,
    subject: `【Avelia FunClub】ご注文 ${order.orderNumber} を発送しました`,
    template: ShippedMail({
      customerName: order.user.name,
      orderNumber: order.orderNumber,
      carrier: order.shipment?.carrier ?? null,
      trackingNumber: order.shipment?.trackingNumber ?? null,
      trackingUrl,
      orderUrl: `${env.appUrl}/mypage/orders/${order.id}`,
    }),
    // 同じ orderId で複数回呼ばれても Resend 側で重複を弾く
    idempotencyKey: `shipped:${order.id}`,
  });
}
