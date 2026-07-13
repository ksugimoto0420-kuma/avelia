import { Hr, Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

export type LotteryWonMailProps = {
  customerName?: string | null;
  lotteryTitle: string;
  productName?: string | null;
  eventTitle?: string | null;
  /** 購入期限 (JST 表示文字列)。null なら「なし」表示。 */
  purchaseDeadlineLabel?: string | null;
  /** 購入手続きページのURL (絶対URL)。 */
  purchaseUrl: string;
};

/**
 * 抽選当選通知メール (#9)。
 * 応募していた抽選で当選したユーザーに、購入手続きへの導線とともに送る。
 */
export function LotteryWonMail({
  customerName,
  lotteryTitle,
  productName,
  eventTitle,
  purchaseDeadlineLabel,
  purchaseUrl,
}: LotteryWonMailProps) {
  const displayName = customerName?.trim() || "お客様";
  return (
    <BaseLayout preview={`「${lotteryTitle}」に当選しました🎉`}>
      <Text style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 12px" }}>
        当選のお知らせ🎉
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        {displayName} 様
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        ご応募いただいた抽選に <b>当選</b> されました。
        おめでとうございます!
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

      {productName && (
        <>
          <Text
            style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 4px" }}
          >
            対象商品
          </Text>
          <Text style={{ margin: "0 0 12px", fontSize: "14px" }}>
            {productName}
          </Text>
        </>
      )}

      {purchaseDeadlineLabel && (
        <>
          <Text
            style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 4px" }}
          >
            購入期限
          </Text>
          <Text
            style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: 700 }}
          >
            {purchaseDeadlineLabel}
          </Text>
        </>
      )}

      <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />
      <Text style={{ margin: "0 0 12px", fontSize: "14px", lineHeight: "22px" }}>
        下のリンクから、購入期限内にお手続きをお願いいたします。
        期限を過ぎると当選権利は失効いたします。
      </Text>
      <Text style={{ margin: "0", fontSize: "14px" }}>
        <a
          href={purchaseUrl}
          style={{
            color: "#7c3aed",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          購入手続きへ進む →
        </a>
      </Text>
    </BaseLayout>
  );
}
