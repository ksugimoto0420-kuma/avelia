import { Hr, Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

export type EventCancelledMailProps = {
  customerName?: string | null;
  eventTitle: string;
  orderNumber: string;
  /** 管理者が入力したキャンセル理由 (自由文)。空なら定型文のみ。 */
  reason?: string | null;
  /** 返金額 (円)。全額返金の想定。 */
  refundAmount: number;
  /** マイページの注文詳細URL (絶対URL)。 */
  orderUrl: string;
};

/**
 * イベントキャンセル通知メール (#42)。
 * 管理者側で対象注文を一括返金したときに、対象ファンへ詫び文と返金額を送る。
 */
export function EventCancelledMail({
  customerName,
  eventTitle,
  orderNumber,
  reason,
  refundAmount,
  orderUrl,
}: EventCancelledMailProps) {
  const displayName = customerName?.trim() || "お客様";
  const yen = `¥${refundAmount.toLocaleString("ja-JP")}`;
  return (
    <BaseLayout preview={`「${eventTitle}」は開催中止となりました`}>
      <Text style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 12px" }}>
        イベント開催中止のお詫び
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        {displayName} 様
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        いつも Avelia FunClub をご利用いただき、誠にありがとうございます。
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        誠に申し訳ございませんが、下記イベントは開催中止となりました。
        ご購入いただいたご注文はキャンセル扱いとし、お支払いいただいた
        金額を全額返金いたします。
      </Text>

      <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />
      <Text
        style={{
          fontSize: "12px",
          color: "#6b7280",
          margin: "0 0 4px",
        }}
      >
        対象イベント
      </Text>
      <Text style={{ margin: "0 0 12px", fontSize: "14px" }}>{eventTitle}</Text>
      <Text
        style={{
          fontSize: "12px",
          color: "#6b7280",
          margin: "0 0 4px",
        }}
      >
        ご注文番号
      </Text>
      <Text style={{ margin: "0 0 12px", fontSize: "14px" }}>
        {orderNumber}
      </Text>
      <Text
        style={{
          fontSize: "12px",
          color: "#6b7280",
          margin: "0 0 4px",
        }}
      >
        返金額
      </Text>
      <Text style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700 }}>
        {yen}
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
            中止理由
          </Text>
          <Text
            style={{
              margin: "0 0 12px",
              fontSize: "14px",
              whiteSpace: "pre-wrap",
              lineHeight: "22px",
            }}
          >
            {reason}
          </Text>
        </>
      )}

      <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />
      <Text style={{ margin: "0 0 12px", fontSize: "13px", lineHeight: "22px" }}>
        返金はお支払いに使用されたクレジットカード会社を通じて処理されます。
        カード会社の締日により、明細への反映は数日〜1ヶ月ほどかかる場合が
        ございます。ご不明な点がございましたらサポート窓口までご連絡ください。
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
          ご注文詳細を開く →
        </a>
      </Text>
    </BaseLayout>
  );
}
