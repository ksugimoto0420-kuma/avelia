import { Hr, Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

export type SignatureReadyMailProps = {
  customerName?: string | null;
  /** 宛名 (「〇〇さんへ」の 〇〇)。 */
  nickname?: string | null;
  productName: string;
  eventTitle: string;
  artistName?: string | null;
  /** 写真サイン or 動画サイン。本文とリンク先が分岐する。 */
  mediaKind: "photo" | "video";
  /** マイページの一覧URL (絶対URL)。 */
  mypageUrl: string;
  /** 主導線となる遷移先URL (写真: 合成ページ / 動画: マイページ)。 */
  playerUrl?: string | null;
};

/**
 * タレントがサインを書き終えた瞬間にファンへ届く即時通知メール。
 * 写真サインなら「デジタルコンテンツ一覧から表示」、
 * 動画サインなら「再生ページを開く」に導線を分岐する。
 */
export function SignatureReadyMail({
  customerName,
  nickname,
  productName,
  eventTitle,
  artistName,
  mediaKind,
  mypageUrl,
  playerUrl,
}: SignatureReadyMailProps) {
  const displayName = customerName?.trim() || "お客様";
  const isVideo = mediaKind === "video";
  const heading = isVideo
    ? "動画サインが届きました🎬"
    : "サインが届きました✨";
  const preview = isVideo
    ? `${artistName ? artistName + "さんの" : ""}動画サインの準備ができました`
    : `${artistName ? artistName + "さんの" : ""}サインの準備ができました`;
  const primaryUrl = isVideo && playerUrl ? playerUrl : mypageUrl;
  const primaryLabel = isVideo ? "動画サインを再生する" : "サインを表示する";

  return (
    <BaseLayout preview={preview}>
      <Text style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 12px" }}>
        {heading}
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        {displayName} 様
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        {artistName ? `${artistName} さん` : "アーティスト"} からの
        {isVideo ? "動画サイン" : "サイン"}が届きました。
        {nickname ? `「${nickname}」宛のご注文分です。` : ""}
      </Text>

      <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />

      <Text
        style={{
          fontSize: "12px",
          color: "#6b7280",
          margin: "0 0 4px",
        }}
      >
        イベント
      </Text>
      <Text style={{ margin: "0 0 12px", fontSize: "14px" }}>{eventTitle}</Text>
      <Text
        style={{
          fontSize: "12px",
          color: "#6b7280",
          margin: "0 0 4px",
        }}
      >
        商品
      </Text>
      <Text style={{ margin: "0 0 16px", fontSize: "14px" }}>{productName}</Text>

      <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />

      <Text style={{ margin: "0 0 12px", fontSize: "14px", lineHeight: "22px" }}>
        {isVideo
          ? "下のリンクから、書き込みが重ねられた動画をご覧いただけます。"
          : "下のリンクから、マイページのデジタルコンテンツを開いてご覧いただけます。"}
      </Text>
      <Text style={{ margin: "0 0 12px", fontSize: "14px" }}>
        <a
          href={primaryUrl}
          style={{
            color: "#7c3aed",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {primaryLabel} →
        </a>
      </Text>

      {isVideo && playerUrl && (
        <Text
          style={{
            margin: "12px 0 0",
            fontSize: "12px",
            color: "#6b7280",
            lineHeight: "18px",
          }}
        >
          再生できない場合はマイページ (
          <a
            href={mypageUrl}
            style={{ color: "#7c3aed", textDecoration: "none" }}
          >
            デジタルコンテンツ一覧
          </a>
          ) からもアクセスできます。
        </Text>
      )}
    </BaseLayout>
  );
}
