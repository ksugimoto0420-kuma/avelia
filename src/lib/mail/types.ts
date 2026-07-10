// メール送信の共通型。

/** 単発メール送信の最小入力。 */
export type SendMailInput = {
  to: string | string[];
  subject: string;
  /** プレーンテキスト本文。html と両方渡すと Gmail などでフォールバックされる。 */
  text: string;
  html?: string;
  /** 運営宛のBcc（任意）。設定していない場合は無視。 */
  bcc?: string | string[];
  /** 一意なメール識別子。同じキーで複数回呼ばれても1回しか送信しない（実装は将来）。 */
  idempotencyKey?: string;
};

/** ドライバーが実装するインターフェース。 */
export interface MailDriver {
  send(input: SendMailInput): Promise<void>;
}
