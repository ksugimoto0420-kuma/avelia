import { Hr, Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

export type LotteryLostMailProps = {
  customerName?: string | null;
  lotteryTitle: string;
  eventTitle?: string | null;
  /** マイページ「抽選結果」への絶対URL。 */
  resultsUrl: string;
};

/**
 * 抽選落選通知メール (#9)。
 * 応募していた抽選で落選した (LOST) ユーザーへの丁寧な通知。
 * 次回応募への誘導もあわせて。
 */
export function LotteryLostMail({
  customerName,
  lotteryTitle,
  eventTitle,
  resultsUrl,
}: LotteryLostMailProps) {
  const displayName = customerName?.trim() || "お客様";
  return (
    <BaseLayout preview={`「${lotteryTitle}」抽選結果のお知らせ`}>
      <Text style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 12px" }}>
        抽選結果のお知らせ
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        {displayName} 様
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        いつも Avelia FunClub をご利用いただき、誠にありがとうございます。
      </Text>

      <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />
      <Text
        style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 4px" }}
      >
        抽選タイトル
      </Text>
      <Text style={{ margin: "0 0 12px", fontSize: "14px" }}>
        {lotteryTitle}
      </Text>
      {eventTitle && (
        <>
          <Text
            style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 4px" }}
          >
            対象イベント
          </Text>
          <Text style={{ margin: "0 0 12px", fontSize: "14px" }}>
            {eventTitle}
          </Text>
        </>
      )}

      <Text style={{ margin: "16px 0 12px", lineHeight: "22px" }}>
        誠に恐れ入りますが、今回はご当選には至りませんでした。
        ご応募いただきましたことに、心より感謝申し上げます。
      </Text>
      <Text style={{ margin: "0 0 16px", lineHeight: "22px" }}>
        今後もアーティストの魅力をお届けする企画をご用意してまいります。
        次回のご応募もぜひお待ちしております。
      </Text>

      <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />
      <Text style={{ margin: "0", fontSize: "13px" }}>
        <a
          href={resultsUrl}
          style={{
            color: "#7c3aed",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          抽選結果一覧を見る →
        </a>
      </Text>
    </BaseLayout>
  );
}
