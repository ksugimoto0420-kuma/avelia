import { Resend } from "resend";
import { env } from "@/lib/env";
import type { MailDriver, SendMailInput } from "../types";

/**
 * Resend 用ドライバー。RESEND_API_KEY を SDK に渡す。
 * 未設定なら初期化時に投げる (index.ts で選択する時点で防ぐ設計)。
 */
export class ResendMailDriver implements MailDriver {
  private client: Resend;

  constructor() {
    if (!env.mail.resendApiKey) {
      throw new Error(
        "RESEND_API_KEY が未設定のため ResendMailDriver を初期化できません",
      );
    }
    this.client = new Resend(env.mail.resendApiKey);
  }

  async send(input: SendMailInput): Promise<void> {
    try {
      const { error } = await this.client.emails.send({
        from: env.mail.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        bcc: input.bcc,
      });
      if (error) {
        // Resend の応答エラー。呼び出し側が拾って再送判断ができるよう投げる。
        throw new Error(`Resend 送信エラー: ${error.message}`);
      }
    } catch (err) {
      // ネットワーク例外含め、上位で拾わせる。
      throw err;
    }
  }
}
