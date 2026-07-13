import { Hr, Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

export type ShippedMailProps = {
  customerName?: string | null;
  orderNumber: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  /** 追跡URL (配送会社の公開URL)。null なら追跡リンクは非表示。 */
  trackingUrl?: string | null;
  /** 注文詳細ページの絶対URL。 */
  orderUrl: string;
};

/**
 * 発送完了メール (#40)。物品発送済み → 追跡番号URL付きで購入者に通知。
 * 配送会社ごとの URL マッピングは carrierTrackingUrl ヘルパー参照。
 */
export function ShippedMail({
  customerName,
  orderNumber,
  carrier,
  trackingNumber,
  trackingUrl,
  orderUrl,
}: ShippedMailProps) {
  const displayName = customerName?.trim() || "お客様";
  return (
    <BaseLayout preview={`ご注文 ${orderNumber} を発送しました`}>
      <Text style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 12px" }}>
        商品を発送しました🚚
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        {displayName} 様
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        ご注文 <b>{orderNumber}</b> の商品を発送いたしました。
        お手元に届くまで今しばらくお待ちください。
      </Text>

      {(carrier || trackingNumber) && (
        <>
          <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />
          {carrier && (
            <>
              <Text
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  margin: "0 0 4px",
                }}
              >
                配送会社
              </Text>
              <Text style={{ margin: "0 0 12px", fontSize: "14px" }}>
                {carrier}
              </Text>
            </>
          )}
          {trackingNumber && (
            <>
              <Text
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  margin: "0 0 4px",
                }}
              >
                追跡番号
              </Text>
              <Text style={{ margin: "0 0 12px", fontSize: "14px" }}>
                {trackingNumber}
              </Text>
            </>
          )}
          {trackingUrl && (
            <Text style={{ margin: "0 0 12px", fontSize: "14px" }}>
              <a
                href={trackingUrl}
                style={{
                  color: "#7c3aed",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                配送状況を追跡する →
              </a>
            </Text>
          )}
        </>
      )}

      <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />
      <Text style={{ margin: "0 0 12px", fontSize: "14px", lineHeight: "22px" }}>
        ご注文内容はマイページからいつでもご確認いただけます。
      </Text>
      <Text style={{ margin: "0", fontSize: "13px" }}>
        <a
          href={orderUrl}
          style={{
            color: "#7c3aed",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          注文詳細を開く →
        </a>
      </Text>
    </BaseLayout>
  );
}
