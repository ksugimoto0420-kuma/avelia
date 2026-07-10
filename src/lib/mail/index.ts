// メール送信の統一エントリポイント。
//
// 使い分け:
//   - sendMail(input)                                  : 生の text/html を直接送る (既存互換)
//   - sendMailTemplate(templateElement, meta)          : React Email テンプレを描画して送る
//
// ドライバー切替は MAIL_DRIVER env で決まる:
//   - "resend"   : 本番/Preview。RESEND_API_KEY が必要
//   - "console"  : ローカル開発。デフォルト

import { render } from "@react-email/render";
import type * as React from "react";
import { env } from "@/lib/env";
import { ConsoleMailDriver } from "./drivers/console";
import { ResendMailDriver } from "./drivers/resend";
import type { MailDriver, SendMailInput } from "./types";

function createDriver(): MailDriver {
  if (env.mail.driver === "resend" && env.mail.resendApiKey) {
    return new ResendMailDriver();
  }
  // resend 選択されていても API key 未設定なら安全側に console に落とす
  return new ConsoleMailDriver();
}

// 遅延初期化 (テストでモックしやすいように)
let cachedDriver: MailDriver | null = null;
function getDriver(): MailDriver {
  if (!cachedDriver) cachedDriver = createDriver();
  return cachedDriver;
}

/**
 * 生の text/html を送るシンプルな API。
 * 既存の src/lib/mail.ts の sendMail 呼び出し元と互換。
 */
export async function sendMail(input: SendMailInput): Promise<void> {
  try {
    await getDriver().send(input);
  } catch (err) {
    // 呼び出し側のフローを止めない: 送信失敗は console にログを残すのみ
    // 冪等キー付きで再送を実装する予定 (別Issue)
    const to = Array.isArray(input.to) ? input.to.join(",") : input.to;
    console.error(
      `[mail] 送信失敗 to=${to} subject="${input.subject}"`,
      err,
    );
  }
}

/**
 * React Email テンプレートを描画して送信する。
 * template には <BaseLayout>...</BaseLayout> を含んだ React 要素を渡す。
 *
 * 例:
 *   await sendMailTemplate({
 *     to: "user@example.com",
 *     subject: "テスト",
 *     template: <DebugMail recipient="user@example.com" />,
 *   });
 */
export async function sendMailTemplate(args: {
  to: string | string[];
  subject: string;
  template: React.ReactElement;
  bcc?: string | string[];
  idempotencyKey?: string;
}): Promise<void> {
  const html = await render(args.template, { pretty: false });
  const text = await render(args.template, { plainText: true });
  await sendMail({
    to: args.to,
    subject: args.subject,
    text,
    html,
    bcc: args.bcc,
    idempotencyKey: args.idempotencyKey,
  });
}

export type { SendMailInput, MailDriver } from "./types";
