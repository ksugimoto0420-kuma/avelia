"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatYen } from "@/lib/utils";

export type VariantOption = {
  id: string;
  name: string;
  price: number;
  available: number;
  requiresNickname: boolean;
};

export function AddToCart({
  variants,
  purchasable,
  maxPerOrder,
  nicknameNote,
}: {
  variants: VariantOption[];
  purchasable: boolean;
  maxPerOrder: number | null;
  nicknameNote?: string | null;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { show } = useToast();
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [nickname, setNickname] = useState("");
  const [nicknameKana, setNicknameKana] = useState("");
  const [loading, setLoading] = useState(false);

  const selected = variants.find((v) => v.id === variantId);
  const requiresNickname = selected?.requiresNickname ?? false;
  const maxQty = Math.min(
    selected?.available ?? 0,
    maxPerOrder ?? Number.MAX_SAFE_INTEGER,
  );

  async function addToCart() {
    if (!session?.user) {
      const back = window.location.pathname;
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(back)}`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId,
          quantity,
          nickname: requiresNickname ? nickname.trim() : undefined,
          nicknameKana: requiresNickname ? nicknameKana.trim() : undefined,
        }),
      });
      if (res.status === 401) {
        const back = window.location.pathname;
        router.push(`/auth/login?callbackUrl=${encodeURIComponent(back)}`);
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "追加に失敗しました");
      show("カートに追加しました");
      setNickname("");
      setNicknameKana("");
      router.refresh();
    } catch (err) {
      show(err instanceof Error ? err.message : "エラー", "error");
    } finally {
      setLoading(false);
    }
  }

  if (!purchasable) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm font-medium text-gray-500">
        現在購入できません
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {variants.length > 1 && (
        <Select
          label="種類・メンバーを選択"
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
        >
          {variants.map((v) => (
            <option key={v.id} value={v.id} disabled={v.available <= 0}>
              {v.name} — {formatYen(v.price)}
              {v.available <= 0 ? "（売切）" : ""}
            </option>
          ))}
        </Select>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="shrink-0 whitespace-nowrap text-sm font-medium text-gray-700">
          数量
        </label>
        <Select
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-24 shrink-0"
        >
          {Array.from({ length: Math.max(1, Math.min(maxQty, 20)) }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </Select>
        <span className="whitespace-nowrap text-xs text-gray-400">
          （在庫 {selected?.available ?? 0}）
        </span>
      </div>

      {requiresNickname && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
          <p className="mb-2 text-xs text-brand-700">
            ✦ サイン宛名・お呼びする「ニックネーム」を商品ごとに指定できます。
            {nicknameNote ?? "10文字以内・よみがな必須。"}
            <br />
            ここで入力するか、カートページで商品ごとに入力できます。
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="ニックネーム（任意・10文字以内）"
              maxLength={10}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="例: ひな"
            />
            <Input
              label="よみがな"
              maxLength={20}
              value={nicknameKana}
              onChange={(e) => setNicknameKana(e.target.value)}
              placeholder="例: ヒナ"
            />
          </div>
        </div>
      )}

      <Button
        onClick={addToCart}
        disabled={loading || maxQty <= 0}
        size="lg"
        fullWidth
      >
        {loading ? "追加中…" : "カートに入れる"}
      </Button>
      {maxPerOrder != null && (
        <p className="text-center text-xs text-gray-400">
          1注文あたり {maxPerOrder} 個まで
        </p>
      )}
    </div>
  );
}
