"use client";

import { useState } from "react";

/**
 * ログイン中ユーザーのメール未確認時にマイページ等の上部に表示する
 * リマインダーバナー。再送信ボタン付き。
 * サーバー側で emailVerified === null のときのみ描画する。
 */
export function UnverifiedEmailBanner({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<
    | { kind: "ok" }
    | { kind: "error"; message: string }
    | null
  >(null);

  const resend = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/auth/verify/resend", { method: "POST" });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(json.error?.message ?? "再送信に失敗しました");
      }
      setResult({ kind: "ok" });
    } catch (e) {
      setResult({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">メールアドレスを確認してください</p>
      <p className="mt-1 text-xs leading-5 text-amber-800">
        <span className="font-medium">{email}</span>{" "}
        宛にメール確認リンクを送信しました。リンクをクリックすると、決済など一部機能が利用可能になります。
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={resend}
          disabled={sending}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending && (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          )}
          確認メールを再送信
        </button>
        {result?.kind === "ok" && (
          <span className="text-xs text-green-700">
            送信しました。受信箱をご確認ください。
          </span>
        )}
        {result?.kind === "error" && (
          <span className="text-xs text-red-600">失敗: {result.message}</span>
        )}
      </div>
    </div>
  );
}
