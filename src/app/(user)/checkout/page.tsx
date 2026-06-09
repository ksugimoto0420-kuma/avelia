"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { CartSummary } from "@/components/user/CartSummary";
import { useToast } from "@/components/ui/Toast";
import { formatYen } from "@/lib/utils";

type CartItem = {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  type: "PHYSICAL" | "DIGITAL";
  requiresNickname: boolean;
  nicknameNote: string | null;
  unitNicknames: {
    nickname: string | null;
    nicknameKana: string | null;
    note: string | null;
  }[];
  quantity: number;
  lineTotal: number;
};

type CartView = { items: CartItem[]; subtotal: number; purchasable: boolean };

export default function CheckoutPage() {
  const router = useRouter();
  const { show } = useToast();
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recipient, setRecipient] = useState({
    recipientName: "",
    recipientKana: "",
    recipientPhone: "",
    recipientPostal: "",
    recipientAddress: "",
    shippingMethod: "宅配便",
  });

  const hasPhysical = cart?.items.some((i) => i.type === "PHYSICAL") ?? false;

  const load = useCallback(async () => {
    const res = await fetch("/api/cart");
    if (res.status === 401) {
      window.location.href = "/auth/login?callbackUrl=/checkout";
      return;
    }
    const json = await res.json();
    setCart(json.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateRecipient(key: keyof typeof recipient) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setRecipient((r) => ({ ...r, [key]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cart) return;
    setSubmitting(true);
    setError(null);

    try {
      // 1) 注文作成（在庫仮確保）。ニックネームはカート投入時に保存済み。
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipient),
      });
      const orderJson = await orderRes.json();
      if (!orderRes.ok)
        throw new Error(orderJson?.error?.message ?? "注文作成に失敗しました");
      const { orderId } = orderJson.data;

      // 2) 決済セッション開始
      const payRes = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const payJson = await payRes.json();
      if (!payRes.ok)
        throw new Error(payJson?.error?.message ?? "決済開始に失敗しました");

      if (payJson.data.devMode) {
        // ローカル：疑似決済
        await fetch("/api/payments/dev-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        router.push(`/payment/success?order=${payJson.data.orderNumber}`);
        return;
      }

      window.location.href = payJson.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
      setSubmitting(false);
      // 在庫確保が崩れている可能性があるためカート再読込
      load();
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center text-gray-400">
        読み込み中…
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center text-gray-500">
        カートが空です
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">ご注文手続き</h1>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {error && <Alert tone="error">{error}</Alert>}

          {hasPhysical && (
            <Card>
              <CardHeader title="お届け先" subtitle="物販商品の配送先情報" />
              <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="お名前"
                  required
                  value={recipient.recipientName}
                  onChange={updateRecipient("recipientName")}
                />
                <Input
                  label="フリガナ"
                  value={recipient.recipientKana}
                  onChange={updateRecipient("recipientKana")}
                />
                <Input
                  label="電話番号"
                  value={recipient.recipientPhone}
                  onChange={updateRecipient("recipientPhone")}
                />
                <Input
                  label="郵便番号"
                  value={recipient.recipientPostal}
                  onChange={updateRecipient("recipientPostal")}
                />
                <div className="sm:col-span-2">
                  <Input
                    label="住所"
                    value={recipient.recipientAddress}
                    onChange={updateRecipient("recipientAddress")}
                  />
                </div>
              </CardBody>
            </Card>
          )}

          {!hasPhysical && (
            <Card>
              <CardHeader
                title="お客様情報"
                subtitle="デジタルコンテンツはマイページに付与されます"
              />
              <CardBody>
                <Input
                  label="お名前"
                  required
                  value={recipient.recipientName}
                  onChange={updateRecipient("recipientName")}
                />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="ご注文内容" />
            <CardBody className="space-y-4">
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-900">
                      {item.productName}（{item.variantName}）× {item.quantity}
                    </span>
                    <span className="font-semibold">
                      {formatYen(item.lineTotal)}
                    </span>
                  </div>
                  {item.requiresNickname && (
                    <div className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium text-brand-700">
                          ニックネーム（サイン宛名）
                        </span>
                        <Link href="/cart" className="text-brand-600 underline">
                          カートで変更
                        </Link>
                      </div>
                      <ul className="space-y-0.5">
                        {item.unitNicknames.map((u, idx) => (
                          <li key={idx} className="text-brand-800">
                            {item.quantity >= 2 && (
                              <span className="mr-1 text-gray-400">
                                {idx + 1}個目:
                              </span>
                            )}
                            <b>{u.nickname ?? "未入力"}</b>
                            {u.nicknameKana && `（${u.nicknameKana}）`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <CartSummary
            subtotal={cart.subtotal}
            actionLabel={submitting ? "処理中…" : "決済に進む"}
            onAction={() => {}}
            disabled={submitting}
          />
          <p className="mt-3 text-center text-xs text-gray-400">
            「決済に進む」で外部決済画面に移動します
          </p>
          {/* 実送信は submit ボタンで行う */}
          <Button
            type="submit"
            fullWidth
            size="lg"
            className="mt-3"
            disabled={submitting}
          >
            {submitting ? "処理中…" : "この内容で決済する"}
          </Button>
        </div>
      </div>
    </form>
  );
}
