import { Button, Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

export type VerifyEmailMailProps = {
  verifyUrl: string;
  /** 未入力時は "お客様" とフォールバック */
  name?: string | null;
};

/**
 * 新規会員登録直後に送信するメール確認用リンクメール。
 * verifyUrl は /auth/verify?token=... の絶対URL。
 */
export function VerifyEmailMail({ verifyUrl, name }: VerifyEmailMailProps) {
  const displayName = name?.trim() || "お客様";
  return (
    <BaseLayout preview="メールアドレスの確認をお願いします">
      <Text style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>
        メールアドレスの確認
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        {displayName} 様、ご登録ありがとうございます。
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        以下のボタンから、メールアドレスの確認をお願いします。
        リンクは 24 時間有効です。
      </Text>
      <Button
        href={verifyUrl}
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
        メールアドレスを確認する
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
        {verifyUrl}
      </Text>
      <Text
        style={{
          margin: "12px 0 0",
          fontSize: "12px",
          color: "#6b7280",
          lineHeight: "18px",
        }}
      >
        心当たりのない場合は、このメールを破棄してください。
      </Text>
    </BaseLayout>
  );
}
