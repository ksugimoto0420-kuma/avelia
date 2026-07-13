import { Hr, Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

export type PaymentFailedMailProps = {
  customerName?: string | null;
  orderNumber: string;
  /** Stripe から取れた理由 (英語のことが多い) を人間向け文言に整えて渡す。 */
  reason?: string | null;
  /** 再決済のリンク (checkout 再開URL or カートへの誘導)。 */
  retryUrl: string;
  /** 仮確保の有効期限。過ぎている場合は表示しない。 */
  reservationExpiresAt?: Date | null;
};

/**
 * 決済失敗通知メール (#41)。Stripe webhook で failed イベントを受けたときに送る。
 * 仮確保が生きているうちに再決済リンクへ誘導する。
 */
export function PaymentFailedMail({
  customerName,
  orderNumber,
  reason,
  retryUrl,
  reservationExpiresAt,
}: PaymentFailedMailProps) {
  const displayName = customerName?.trim() || "お客様";
  const expiresLabel = reservationExpiresAt
    ? new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
      }).format(reservationExpiresAt)
    : null;
  return (
    <BaseLayout preview={`ご注文 ${orderNumber} の決済ができませんでした`}>
      <Text style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 12px" }}>
        決済ができませんでした
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        {displayName} 様
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        ご注文 <b>{orderNumber}</b> のお支払い処理が完了しませんでした。
      </Text>
      {reason && (
        <>
          <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />
          <Text
            style={{
              fontSize: "12px",
              color: "#6b7280",
              margin: "0 0 4px",
            }}
          >
            エラー内容
          </Text>
          <Text style={{ margin: "0 0 12px", fontSize: "14px" }}>{reason}</Text>
        </>
      )}
      <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />
      <Text style={{ margin: "0 0 12px", fontSize: "14px", lineHeight: "22px" }}>
        下のリンクから再度お手続きいただけます。
        {expiresLabel && (
          <>
            <br />
            商品の仮確保は <b>{expiresLabel}</b> までとなります。
            それを過ぎると再注文が必要です。
          </>
        )}
      </Text>
      <Text style={{ margin: "0 0 12px", fontSize: "14px" }}>
        <a
          href={retryUrl}
          style={{
            color: "#7c3aed",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          決済をやり直す →
        </a>
      </Text>
    </BaseLayout>
  );
}
