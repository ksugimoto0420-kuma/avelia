"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/mypage";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("user-credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("メールアドレスまたはパスワードが正しくありません");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Input
        label="メールアドレス"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="パスワード"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" fullWidth size="lg" disabled={loading}>
        {loading ? "ログイン中…" : "ログイン"}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/auth/reset-password" className="text-brand-600 hover:underline">
          パスワードを忘れた方
        </Link>
        <Link href="/auth/register" className="text-brand-600 hover:underline">
          新規登録
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">
        ログイン
      </h1>
      <Card>
        <CardBody>
          <Suspense fallback={<div className="text-center text-gray-400">…</div>}>
            <LoginForm />
          </Suspense>
        </CardBody>
      </Card>
    </div>
  );
}
