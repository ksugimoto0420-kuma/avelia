import { Hr, Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

export type EventReminderMailProps = {
  customerName?: string | null;
  eventTitle: string;
  /** 開催日時 (JST 表示用文字列)。 */
  eventDateLabel: string;
  /** 配信URL (YouTube Live 等) が設定されていれば表示。 */
  streamingUrl?: string | null;
  /** マイページの注文詳細URL。 */
  orderUrl: string;
};

/**
 * イベント開催前日リマインダー (#43)。
 * 明日開催されるイベントを購入済みユーザーに前日通知する。
 */
export function EventReminderMail({
  customerName,
  eventTitle,
  eventDateLabel,
  streamingUrl,
  orderUrl,
}: EventReminderMailProps) {
  const displayName = customerName?.trim() || "お客様";
  return (
    <BaseLayout preview={`「${eventTitle}」は明日開催です`}>
      <Text style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 12px" }}>
        まもなく開催です🎉
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        {displayName} 様
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        ご購入いただいた <b>「{eventTitle}」</b> が明日開催されます。
        当日はお時間に余裕を持ってご参加ください。
      </Text>

      <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />
      <Text
        style={{
          fontSize: "12px",
          color: "#6b7280",
          margin: "0 0 4px",
        }}
      >
        開催日時
      </Text>
      <Text style={{ margin: "0 0 12px", fontSize: "14px" }}>
        {eventDateLabel}
      </Text>

      {streamingUrl && (
        <>
          <Text
            style={{
              fontSize: "12px",
              color: "#6b7280",
              margin: "0 0 4px",
            }}
          >
            配信URL
          </Text>
          <Text style={{ margin: "0 0 12px", fontSize: "14px" }}>
            <a
              href={streamingUrl}
              style={{
                color: "#7c3aed",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              視聴ページを開く →
            </a>
          </Text>
        </>
      )}

      <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />
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
