import { Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

/**
 * 動作確認用のダミーメール。
 * Preview デプロイ後に管理者宛に送って、レイアウト崩れがないかを目視確認する用途。
 */
export type DebugMailProps = {
  recipient: string;
  message?: string;
};

export function DebugMail({ recipient, message }: DebugMailProps) {
  return (
    <BaseLayout preview={`テストメール - ${recipient} 宛`}>
      <Text style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>
        メール送信基盤の動作確認
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        こんにちは、{recipient} さん。
      </Text>
      <Text style={{ margin: "0 0 12px", lineHeight: "22px" }}>
        このメールは Resend + React Email による送信基盤の動作確認です。
        本文が正しく整形されて届いていれば、以降のメール実装は本テンプレートを土台に進められます。
      </Text>
      {message && (
        <Text style={{ margin: "0", lineHeight: "22px", color: "#4b5563" }}>
          追加メッセージ: {message}
        </Text>
      )}
    </BaseLayout>
  );
}
