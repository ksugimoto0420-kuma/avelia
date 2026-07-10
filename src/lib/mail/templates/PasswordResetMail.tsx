import { Button, Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

export type PasswordResetMailProps = {
  resetUrl: string;
  name?: string | null;
};

/**
 * パスワード再設定リンクを送るためのメールテンプレ。
 * resetUrl は /auth/reset-password?token=... の絶対URL。
 */
export function PasswordResetMail({ resetUrl, name }: PasswordResetMailProps) {
  const displayName = name?.trim() || "お客様";
  return (
    <BaseLayout preview="パスワード再設定のご案内">
      <Text style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>
        パスワード再設定
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        {displayName} 様、
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        パスワード再設定のリクエストを受け付けました。以下のボタンから
        1 時間以内に新しいパスワードを設定してください。
      </Text>
      <Button
        href={resetUrl}
        style={{
          backgroundColor: "#7c3aed",
          borderRadius: "8px",
          color: "#ffffff",
          fontWeight: 700,
          padding: "12px 20px",
          textDecoration: "none",
          display: "inline-block",
        }}
      >
        パスワードを再設定する
      </Button>
      <Text
        style={{
          margin: "16px 0 0",
          fontSize: "12px",
          color: "#6b7280",
          lineHeight: "18px",
        }}
      >
        ボタンが動作しない場合は、以下のURLをブラウザに貼り付けてアクセスしてください。
        <br />
        {resetUrl}
      </Text>
      <Text
        style={{
          margin: "12px 0 0",
          fontSize: "12px",
          color: "#6b7280",
          lineHeight: "18px",
        }}
      >
        このリクエストに心当たりがない場合、このメールは破棄してください。
        パスワードは変更されません。
      </Text>
    </BaseLayout>
  );
}
