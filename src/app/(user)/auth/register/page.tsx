"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "登録に失敗しました");

      // 登録後そのままログイン
      await signIn("user-credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      router.push("/mypage");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">
        新規登録
      </h1>
      <Card>
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}
            <Input
              label="お名前"
              value={form.name}
              onChange={update("name")}
            />
            <Input
              label="メールアドレス"
              type="email"
              required
              value={form.email}
              onChange={update("email")}
            />
            <Input
              label="パスワード"
              type="password"
              required
              hint="8文字以上"
              value={form.password}
              onChange={update("password")}
            />
            <Button type="submit" fullWidth size="lg" disabled={loading}>
              {loading ? "登録中…" : "登録する"}
            </Button>
            <p className="text-center text-sm text-gray-500">
              すでにアカウントをお持ちの方は{" "}
              <Link href="/auth/login" className="text-brand-600 hover:underline">
                ログイン
              </Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
