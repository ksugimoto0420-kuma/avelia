"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";

function ResetFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message);
      setMessage(
        "再設定用のメールを送信しました。メール内のリンクからお進みください。",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    } finally {
      setLoading(false);
    }
  }

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message);
      router.push("/auth/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    } finally {
      setLoading(false);
    }
  }

  if (token) {
    return (
      <form onSubmit={submitNewPassword} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Input
          label="新しいパスワード"
          type="password"
          required
          hint="8文字以上"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" fullWidth size="lg" disabled={loading}>
          パスワードを再設定
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={requestReset} className="space-y-4">
      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <Input
        label="登録メールアドレス"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" fullWidth size="lg" disabled={loading}>
        再設定メールを送る
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">
        パスワード再設定
      </h1>
      <Card>
        <CardBody>
          <Suspense fallback={<div className="text-center text-gray-400">…</div>}>
            <ResetFlow />
          </Suspense>
        </CardBody>
      </Card>
    </div>
  );
}
