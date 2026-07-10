import type { MailDriver, SendMailInput } from "../types";

/**
 * ローカル開発用のフォールバックドライバー。
 * 実際にはメールを送らず、コンソールに出力する。
 */
export class ConsoleMailDriver implements MailDriver {
  async send(input: SendMailInput): Promise<void> {
    const to = Array.isArray(input.to) ? input.to.join(", ") : input.to;
    const bcc = input.bcc
      ? Array.isArray(input.bcc)
        ? input.bcc.join(", ")
        : input.bcc
      : undefined;
    // 開発時に本文まで一覧できるように text を整形して出力
    const body = input.text.replace(/\n/g, "\n  ");
    console.log(
      [
        "",
        "[MAIL]",
        `  to: ${to}`,
        bcc ? `  bcc: ${bcc}` : undefined,
        `  subject: ${input.subject}`,
        input.idempotencyKey
          ? `  idempotencyKey: ${input.idempotencyKey}`
          : undefined,
        "",
        `  ${body}`,
        "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
}
