import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type * as React from "react";

/**
 * 全てのメールで共有する共通レイアウト。
 * ヘッダーのブランド名 / フッターの免責文言をまとめる。
 * サイト名は将来的に env or 設定から取れるようにする。
 */
type BaseLayoutProps = {
  /** メール本文のプレビュー行 (受信箱一覧の抜粋)。 */
  preview: string;
  /** 差し替え可能なブランド名 (例: サイト名確定後に切り替え)。 */
  brandName?: string;
  children: React.ReactNode;
};

const containerStyle = {
  margin: "0 auto",
  padding: "24px 16px",
  maxWidth: "560px",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Segoe UI', sans-serif",
  color: "#111827",
};

const brandStyle = {
  fontSize: "18px",
  fontWeight: 700,
  color: "#7c3aed",
  marginBottom: "16px",
};

const footerStyle = {
  fontSize: "12px",
  color: "#6b7280",
  lineHeight: "18px",
  marginTop: "12px",
};

export function BaseLayout({
  preview,
  brandName = "Avelia FunClub",
  children,
}: BaseLayoutProps) {
  return (
    <Html lang="ja">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f9fafb", margin: 0, padding: 0 }}>
        <Container style={containerStyle}>
          <Text style={brandStyle}>{brandName}</Text>
          <Section
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "24px",
            }}
          >
            {children}
          </Section>
          <Hr style={{ borderColor: "#e5e7eb", marginTop: "24px" }} />
          <Text style={footerStyle}>
            このメールは {brandName} からの自動送信です。返信いただいてもお答えできません。
            <br />
            心当たりのない場合はお手数ですがサポート窓口までご連絡ください。
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
