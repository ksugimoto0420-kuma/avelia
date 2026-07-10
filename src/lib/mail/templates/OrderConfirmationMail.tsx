import { Column, Hr, Row, Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

/** 注文明細行 (1 SKU 1 行相当)。 */
export type OrderConfirmationLine = {
  productName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
};

export type OrderConfirmationMailProps = {
  orderNumber: string;
  paidAt: string; // 表示用の日付文字列 (JST) を渡す
  customerName?: string | null;
  lines: OrderConfirmationLine[];
  /** 合計金額 (円)。小計 = sum(lines) と一致する想定。 */
  totalAmount: number;
  /** 配送/配信予定日 (任意)。 */
  deliveryEta?: string | null;
  /** 発送先住所 (物品購入時のみ)。 */
  shippingAddress?: {
    postalCode?: string | null;
    address?: string | null;
    name?: string | null;
  } | null;
  /** マイページの注文詳細URL (絶対URL)。 */
  mypageUrl: string;
};

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

const rowStyle = { padding: "6px 0" } as const;
const labelStyle = {
  fontSize: "12px",
  color: "#6b7280",
  margin: "0 0 4px",
} as const;

/**
 * 注文確認メール (Stripe 決済成功時に送信)。
 * 明細・合計・宛先・配信/配送予定日を含む。
 */
export function OrderConfirmationMail({
  orderNumber,
  paidAt,
  customerName,
  lines,
  totalAmount,
  deliveryEta,
  shippingAddress,
  mypageUrl,
}: OrderConfirmationMailProps) {
  const displayName = customerName?.trim() || "お客様";
  return (
    <BaseLayout preview={`ご注文ありがとうございます (${orderNumber})`}>
      <Text style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>
        ご注文ありがとうございます
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        {displayName} 様、ご注文の決済が完了しました。
      </Text>

      <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />

      <Row style={rowStyle}>
        <Column>
          <Text style={labelStyle}>注文番号</Text>
          <Text style={{ margin: 0, fontSize: "14px" }}>{orderNumber}</Text>
        </Column>
        <Column>
          <Text style={labelStyle}>ご注文日時</Text>
          <Text style={{ margin: 0, fontSize: "14px" }}>{paidAt}</Text>
        </Column>
      </Row>

      <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />

      <Text style={{ ...labelStyle, marginBottom: "8px" }}>ご注文内容</Text>
      {lines.map((line, idx) => (
        <Row
          key={`${line.productName}-${idx}`}
          style={{ ...rowStyle, borderBottom: "1px solid #f3f4f6" }}
        >
          <Column>
            <Text style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
              {line.productName}
            </Text>
            {line.variantName && (
              <Text
                style={{
                  margin: "2px 0 0",
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                {line.variantName}
              </Text>
            )}
          </Column>
          <Column style={{ width: "120px", textAlign: "right" }}>
            <Text style={{ margin: 0, fontSize: "14px" }}>
              {yen(line.unitPrice)} × {line.quantity}
            </Text>
            <Text style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>
              {yen(line.unitPrice * line.quantity)}
            </Text>
          </Column>
        </Row>
      ))}
      <Row style={{ ...rowStyle, marginTop: "12px" }}>
        <Column>
          <Text style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>
            合計
          </Text>
        </Column>
        <Column style={{ width: "120px", textAlign: "right" }}>
          <Text style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
            {yen(totalAmount)}
          </Text>
        </Column>
      </Row>

      {(shippingAddress || deliveryEta) && (
        <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />
      )}

      {shippingAddress && (
        <>
          <Text style={labelStyle}>お届け先</Text>
          <Text style={{ margin: "0 0 4px", fontSize: "14px" }}>
            {shippingAddress.name ?? displayName}
          </Text>
          {shippingAddress.postalCode && (
            <Text
              style={{
                margin: "0 0 2px",
                fontSize: "13px",
                color: "#4b5563",
              }}
            >
              〒{shippingAddress.postalCode}
            </Text>
          )}
          {shippingAddress.address && (
            <Text
              style={{ margin: "0", fontSize: "13px", color: "#4b5563" }}
            >
              {shippingAddress.address}
            </Text>
          )}
        </>
      )}

      {deliveryEta && (
        <>
          <Text style={{ ...labelStyle, marginTop: "12px" }}>
            {shippingAddress ? "お届け予定" : "配信予定"}
          </Text>
          <Text style={{ margin: 0, fontSize: "14px" }}>{deliveryEta}</Text>
        </>
      )}

      <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0 16px" }} />

      <Text style={{ margin: "0 0 8px", fontSize: "14px", lineHeight: "22px" }}>
        マイページから注文内容とデジタルコンテンツをご確認いただけます。
      </Text>
      <Text style={{ margin: "0", fontSize: "13px" }}>
        <a
          href={mypageUrl}
          style={{
            color: "#7c3aed",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          マイページを開く
        </a>
      </Text>
    </BaseLayout>
  );
}
