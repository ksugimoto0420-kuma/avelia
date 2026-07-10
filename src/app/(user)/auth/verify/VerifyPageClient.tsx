"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type State =
  | { kind: "pending" }
  | { kind: "success"; alreadyVerified: boolean }
  | { kind: "error"; message: string };

export function VerifyPageClient() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "pending" });
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;

    if (!token) {
      setState({ kind: "error", message: "リンクにトークンが含まれていません" });
      return;
    }

    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          data?: { alreadyVerified?: boolean };
          error?: { message?: string };
        };
        if (!res.ok) {
          throw new Error(
            json.error?.message ?? "確認に失敗しました",
          );
        }
        setState({
          kind: "success",
          alreadyVerified: Boolean(json.data?.alreadyVerified),
        });
      })
      .catch((err) => {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }, [token]);

  if (state.kind === "pending") {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
        メールアドレスを確認しています...
      </div>
    );
  }
  if (state.kind === "success") {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="確認が完了しました">
          {state.alreadyVerified
            ? "このメールアドレスは既に確認済みでした。"
            : "メールアドレスの確認が完了しました。ご登録ありがとうございます。"}
        </Alert>
        <div className="flex justify-end gap-2">
          <Button href="/mypage">マイページへ</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Alert tone="error" title="確認できませんでした">
        {state.message}
      </Alert>
      <p className="text-sm text-gray-600">
        リンクの有効期限が切れている場合は、マイページからメールを再送信できます。
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href="/auth/login"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          ログイン
        </Link>
        <Link
          href="/mypage"
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          マイページへ
        </Link>
      </div>
    </div>
  );
}
