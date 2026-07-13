import { sendMailTemplate } from "@/lib/mail";
import { SignatureReadyMail } from "@/lib/mail/templates/SignatureReadyMail";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/**
 * サイン完了 (DigitalDelivery.READY 化) 直後にファンへ即通知するメール。
 *
 * - タレントの直納品 (talent/signatures) からも、管理者承認 (approveSignature)
 *   からも同じ経路で送るため、送信ロジックをここに集約する。
 * - 送信失敗しても呼び出し元のトランザクションを止めないよう、
 *   sendMailTemplate 内でエラーは吸収される (console にログのみ)。
 * - 手動再送 API から呼び直せるように、DB に閉じた形で組み立てる。
 */
export async function sendSignatureReadyMail(deliveryId: string): Promise<void> {
  const delivery = await prisma.digitalDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      user: { select: { email: true, name: true } },
      order: { select: { orderNumber: true } },
      orderItem: { select: { productName: true } },
      digitalContent: {
        select: {
          title: true,
          product: {
            select: {
              productKind: true,
              event: {
                select: {
                  title: true,
                  artistName: true,
                  artist: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!delivery) return;
  if (!delivery.user.email) return;

  const productKind = delivery.digitalContent.product?.productKind ?? null;
  const mediaKind: "photo" | "video" =
    productKind === "DIGITAL_VIDEO_SIGN" ? "video" : "photo";

  const eventTitle = delivery.digitalContent.product?.event.title ?? "イベント";
  const artistName =
    delivery.digitalContent.product?.event.artist?.name ??
    delivery.digitalContent.product?.event.artistName ??
    null;

  const productName =
    delivery.orderItem.productName ?? delivery.digitalContent.title;

  const mypageUrl = `${env.appUrl}/mypage/digital-contents`;
  // 写真サインは合成表示ページ (signed/[deliveryId]) へ直リンクできる。
  // 動画は #38 の再生プレイヤー本番化前なので、当面はマイページ一覧に誘導する。
  const playerUrl =
    mediaKind === "photo"
      ? `${env.appUrl}/mypage/digital-contents/signed/${delivery.id}`
      : mypageUrl;

  await sendMailTemplate({
    to: delivery.user.email,
    subject:
      mediaKind === "video"
        ? "【Avelia FunClub】動画サインが届きました🎬"
        : "【Avelia FunClub】サイン入りコンテンツの準備ができました✨",
    template: SignatureReadyMail({
      customerName: delivery.user.name,
      nickname: delivery.nickname,
      productName,
      eventTitle,
      artistName,
      mediaKind,
      mypageUrl,
      playerUrl,
    }),
    // 同じ deliveryId で複数回叩かれても Resend 側で重複を弾く冪等キー
    idempotencyKey: `signature-ready:${delivery.id}`,
  });
}
