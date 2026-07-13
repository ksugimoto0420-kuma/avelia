"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  renderTemplate,
  sampleVariablesFor,
  type TemplateKind,
  type TemplateSpec,
} from "@/lib/mail/templates-registry";
import { resetMailTemplate, saveMailTemplate } from "../actions";

/**
 * メールテンプレ編集フォーム。
 * - 件名 + 本文の 2 入力
 * - 右側にプレビュー (サンプル値でタグを置換)
 * - タグ一覧のチップをクリックで本文の末尾に挿入
 * - 「既定に戻す」で DB カスタムを削除
 */
export function MailTemplateEditor({
  kind,
  spec,
  initialSubject,
  initialBody,
  hasCustom,
}: {
  kind: TemplateKind;
  spec: TemplateSpec;
  initialSubject: string;
  initialBody: string;
  hasCustom: boolean;
}) {
  const { show } = useToast();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [resetOpen, setResetOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const samples = useMemo(() => sampleVariablesFor(kind), [kind]);
  const previewSubject = useMemo(
    () => renderTemplate(subject, samples),
    [subject, samples],
  );
  const previewBody = useMemo(
    () => renderTemplate(body, samples),
    [body, samples],
  );

  const insertTag = (key: string) => {
    const tag = `{{${key}}}`;
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => b + tag);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + tag + body.slice(end);
    setBody(next);
    // 挿入位置にキャレットを戻す
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + tag.length;
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("kind", kind);
        fd.set("subject", subject);
        fd.set("bodyText", body);
        await saveMailTemplate(fd);
        show("メールテンプレートを保存しました");
      } catch (err) {
        show(err instanceof Error ? err.message : "保存に失敗しました");
      }
    });
  };

  const handleReset = () => {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("kind", kind);
        await resetMailTemplate(fd);
        show("既定に戻しました");
      } catch (err) {
        show(err instanceof Error ? err.message : "リセットに失敗しました");
      }
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            件名
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            使えるタグ (クリックで本文に挿入)
          </label>
          <div className="flex flex-wrap gap-2">
            {spec.tags.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => insertTag(t.key)}
                className="rounded-full border border-brand-300 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                title={`挿入: {{${t.key}}}`}
              >
                {t.label}{" "}
                <span className="text-brand-400">{`{{${t.key}}}`}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            本文
          </label>
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <p className="mt-1 text-xs text-gray-500">
            プレーンテキスト。改行はそのまま反映されます。{"{{タグ}}"} は
            送信時に実際の値に置き換わります。
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
          {hasCustom && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetOpen(true)}
              disabled={pending}
            >
              既定に戻す
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "保存中..." : "保存する"}
            </Button>
          </div>
        </div>
      </form>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="mb-2 text-xs font-semibold text-gray-500">
          プレビュー (サンプル値でタグを置換)
        </p>
        <p className="text-sm text-gray-500">件名</p>
        <p className="mb-3 font-semibold text-gray-900">{previewSubject}</p>
        <p className="text-sm text-gray-500">本文</p>
        <pre className="whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-gray-900">
          {previewBody}
        </pre>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => !pending && setResetOpen(false)}
        title="既定に戻しますか？"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              disabled={pending}
            >
              キャンセル
            </Button>
            <Button variant="danger" onClick={handleReset} disabled={pending}>
              {pending ? "処理中..." : "戻す"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          カスタム設定を削除し、既定のデザイン付きテンプレートで送信するように
          戻します。この操作は取り消せません。
        </p>
      </Modal>
    </div>
  );
}
