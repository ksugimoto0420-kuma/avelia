"use client";

import { useState } from "react";

/** Issue #32 デバッグページ用フォーム。単発でテストメールを送る。 */
export function MailDebugForm() {
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<
    | { kind: "ok"; sentTo: string }
    | { kind: "error"; message: string }
    | null
  >(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/mail-debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, message: message || undefined }),
      });
      const json = (await res.json()) as {
        data?: { sentTo?: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        throw new Error(json.error?.message ?? "送信に失敗しました");
      }
      setResult({ kind: "ok", sentTo: json.data?.sentTo ?? to });
    } catch (err) {
      setResult({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          宛先メールアドレス *
        </label>
        <input
          type="email"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={inputCls}
          placeholder="dev@example.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          追加メッセージ (任意)
        </label>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={inputCls}
          placeholder="例: 本番接続テスト"
        />
      </div>
      <div className="flex items-center justify-between gap-2 pt-2">
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending && (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          送信
        </button>
        {result?.kind === "ok" && (
          <p className="text-xs text-green-600">
            送信しました: {result.sentTo}
          </p>
        )}
        {result?.kind === "error" && (
          <p className="text-xs text-red-600">失敗: {result.message}</p>
        )}
      </div>
    </form>
  );
}
