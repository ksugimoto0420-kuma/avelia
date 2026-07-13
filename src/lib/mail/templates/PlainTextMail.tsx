import { Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

/**
 * 管理画面から編集された本文 (プレーンテキスト、タグ置換済み) を
 * BaseLayout に流し込むだけのシンプルなラッパー。
 *
 * - 改行は `whiteSpace: pre-wrap` で維持
 * - URL の自動リンク化はしない (テンプレ側で本文にそのまま URL を書けば
 *   多くのメールクライアントが自動でリンクにする)
 */
export function PlainTextMail({
  body,
  preview,
}: {
  body: string;
  preview: string;
}) {
  return (
    <BaseLayout preview={preview}>
      <Text
        style={{
          margin: 0,
          fontSize: "14px",
          lineHeight: "22px",
          whiteSpace: "pre-wrap",
        }}
      >
        {body}
      </Text>
    </BaseLayout>
  );
}
