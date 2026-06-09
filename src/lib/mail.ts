import { env } from "@/lib/env";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * メール送信。MAIL_DRIVER=resend かつ RESEND_API_KEY 設定時は Resend、
 * それ以外はコンソール出力にフォールバック（ローカル開発用）。
 */
export async function sendMail(input: MailInput): Promise<void> {
  if (env.mail.driver === "resend" && env.mail.resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.mail.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.mail.from,
          to: input.to,
          subject: input.subject,
          text: input.text,
          html: input.html,
        }),
      });
      if (!res.ok) {
        console.error("[MAIL] Resend 送信失敗", await res.text());
      }
      return;
    } catch (err) {
      console.error("[MAIL] Resend エラー", err);
      return;
    }
  }

  // フォールバック：コンソール出力
  console.log(
    `\n[MAIL] to=${input.to}\n  subject: ${input.subject}\n  ${input.text.replace(/\n/g, "\n  ")}\n`,
  );
}
