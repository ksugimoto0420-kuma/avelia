import type * as React from "react";
import { sendMailTemplate } from "@/lib/mail";
import { PlainTextMail } from "@/lib/mail/templates/PlainTextMail";
import { prisma } from "@/lib/prisma";
import {
  EMAIL_TEMPLATE_SPECS,
  renderTemplate,
  type TemplateKind,
} from "./templates-registry";

/**
 * メール送信の統合エントリーポイント (#9 follow-up)。
 *
 * 1. DB (EmailTemplate) に該当 kind のカスタムがあれば、
 *    件名/本文をタグ置換して PlainTextMail で送信
 * 2. なければ fallback (既存の React Email テンプレ) を送信
 *
 * これによって「基本は既存のリッチテンプレ、必要な文面だけ管理画面で
 * 上書き」という運用ができる。
 */
export async function sendTemplatedMail<V extends Record<string, string | null | undefined>>(args: {
  kind: TemplateKind;
  to: string | string[];
  variables: V;
  /** DB カスタムがない場合に使う React Email 要素 (既存テンプレ)。 */
  fallback: { subject: string; template: React.ReactElement };
  bcc?: string | string[];
  /** Resend 側の重複送信抑止キー。 */
  idempotencyKey?: string;
}): Promise<void> {
  const custom = await prisma.emailTemplate.findUnique({
    where: { kind: args.kind },
    select: { subject: true, bodyText: true },
  });

  if (custom) {
    const spec = EMAIL_TEMPLATE_SPECS[args.kind];
    const subject = renderTemplate(custom.subject, args.variables);
    const body = renderTemplate(custom.bodyText, args.variables);
    // preview は subject を使い回す (受信箱の抜粋)
    await sendMailTemplate({
      to: args.to,
      subject,
      template: PlainTextMail({ body, preview: subject }),
      bcc: args.bcc,
      idempotencyKey: args.idempotencyKey,
    });
    // ロード可能性のためにログを残す (デバッグ・監査用)
    void spec;
    return;
  }

  await sendMailTemplate({
    to: args.to,
    subject: args.fallback.subject,
    template: args.fallback.template,
    bcc: args.bcc,
    idempotencyKey: args.idempotencyKey,
  });
}
