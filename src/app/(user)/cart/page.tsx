"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CartSummary } from "@/components/user/CartSummary";
import { useToast } from "@/components/ui/Toast";
import { SALE_STATUS_LABEL, type SaleStatus } from "@/lib/sale";
import { formatYen } from "@/lib/utils";

type UnitNickname = {
  nickname: string | null;
  nicknameKana: string | null;
  note: string | null;
};

type CartItem = {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  type: "PHYSICAL" | "DIGITAL";
  requiresNickname: boolean;
  nicknameNote: string | null;
  unitNicknames: UnitNickname[];
  nicknameSatisfied: boolean;
  unitPrice: number;
  quantity: number;
  available: number;
  saleStatus: SaleStatus;
  purchasable: boolean;
  lineTotal: number;
};

type CartView = {
  items: CartItem[];
  subtotal: number;
  purchasable: boolean;
};

type Draft = { nickname: string; nicknameKana: string };

export default function CartPage() {
  const { show } = useToast();
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // 明細ごとの数量分ニックネーム編集ドラフト（id -> Draft[]）
  const [drafts, setDrafts] = useState<Record<string, Draft[]>>({});

  const syncDrafts = useCallback((view: CartView) => {
    setDrafts(() => {
      const next: Record<string, Draft[]> = {};
      for (const it of view.items) {
        next[it.id] = Array.from({ length: it.quantity }, (_, i) => ({
          nickname: it.unitNicknames[i]?.nickname ?? "",
          nicknameKana: it.unitNicknames[i]?.nicknameKana ?? "",
        }));
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/cart");
    if (res.status === 401) {
      window.location.href = "/auth/login?callbackUrl=/cart";
      return;
    }
    const json = await res.json();
    setCart(json.data);
    syncDrafts(json.data);
    setLoading(false);
  }, [syncDrafts]);

  useEffect(() => {
    load();
  }, [load]);

  async function patchItem(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/cart/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message);
      setCart(json.data);
      syncDrafts(json.data);
      return true;
    } catch (err) {
      show(err instanceof Error ? err.message : "更新失敗", "error");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function saveNicknames(item: CartItem) {
    const ds = drafts[item.id];
    if (!ds) return;
    const units = ds.map((d) => ({
      nickname: d.nickname.trim() || null,
      nicknameKana: d.nicknameKana.trim() || null,
    }));
    // 変更がなければ送らない
    const same = units.every(
      (u, i) =>
        (u.nickname ?? "") === (item.unitNicknames[i]?.nickname ?? "") &&
        (u.nicknameKana ?? "") === (item.unitNicknames[i]?.nicknameKana ?? ""),
    );
    if (same) return;
    const ok = await patchItem(item.id, { unitNicknames: units });
    if (ok) show("ニックネームを保存しました");
  }

  function setDraft(itemId: string, idx: number, patch: Partial<Draft>) {
    setDrafts((d) => {
      const arr = [...(d[itemId] ?? [])];
      arr[idx] = { ...arr[idx], ...patch };
      return { ...d, [itemId]: arr };
    });
  }

  async function removeItem(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/cart/items/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message);
      setCart(json.data);
      syncDrafts(json.data);
      show("削除しました");
    } catch (err) {
      show(err instanceof Error ? err.message : "削除失敗", "error");
    } finally {
      setBusyId(null);
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
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <p className="text-5xl">🛒</p>
        <p className="mt-4 text-gray-500">カートに商品がありません</p>
        <Button href="/events" className="mt-6">
          イベントを見る
        </Button>
      </div>
    );
  }

  const nicknameMissing = cart.items.some((i) => !i.nicknameSatisfied);
  const canCheckout = cart.purchasable && !nicknameMissing;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">カート</h1>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {cart.items.map((item) => {
            const ds = drafts[item.id] ?? [];
            const missing = !item.nicknameSatisfied;
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="flex gap-4">
                  <Link
                    href={`/products/${item.productId}`}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-50"
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-2xl text-gray-300">
                        🎤
                      </div>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/products/${item.productId}`}
                          className="font-semibold text-gray-900 hover:text-brand-600"
                        >
                          {item.productName}
                        </Link>
                        <p className="text-xs text-gray-500">
                          {item.variantName}
                        </p>
                      </div>
                      {!item.purchasable && (
                        <Badge color="red">
                          {SALE_STATUS_LABEL[item.saleStatus]}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-auto flex items-end justify-between">
                      <div className="flex items-center gap-2">
                        <select
                          value={item.quantity}
                          disabled={busyId === item.id}
                          onChange={(e) =>
                            patchItem(item.id, {
                              quantity: Number(e.target.value),
                            })
                          }
                          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        >
                          {Array.from(
                            {
                              length: Math.max(
                                item.quantity,
                                item.available,
                                1,
                              ),
                            },
                            (_, i) => i + 1,
                          ).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={busyId === item.id}
                          className="text-xs text-gray-400 hover:text-red-600"
                        >
                          削除
                        </button>
                      </div>
                      <p className="font-bold text-gray-900">
                        {formatYen(item.lineTotal)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 商品ごと・数量ごとのニックネーム（サイン宛名・お呼びする名前） */}
                {item.requiresNickname && (
                  <div
                    className={`mt-3 rounded-xl border p-3 ${
                      missing
                        ? "border-red-200 bg-red-50/50"
                        : "border-brand-100 bg-brand-50"
                    }`}
                  >
                    <p className="mb-2 text-xs text-gray-600">
                      ✦ この商品のニックネーム（サイン宛名・お呼びする名前）
                      {item.nicknameNote
                        ? ` ${item.nicknameNote}`
                        : "（10文字以内・よみがな必須）"}
                      {item.quantity >= 2 && "／数量分それぞれご入力ください"}
                      {missing && (
                        <span className="ml-1 font-semibold text-red-600">
                          ※未入力があります
                        </span>
                      )}
                    </p>
                    <div className="space-y-2">
                      {ds.map((d, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          {item.quantity >= 2 && (
                            <span className="w-12 shrink-0 text-xs font-medium text-gray-500">
                              {idx + 1}個目
                            </span>
                          )}
                          <input
                            type="text"
                            maxLength={10}
                            placeholder="ニックネーム（10文字以内）"
                            value={d.nickname}
                            disabled={busyId === item.id}
                            onChange={(e) =>
                              setDraft(item.id, idx, { nickname: e.target.value })
                            }
                            onBlur={() => saveNicknames(item)}
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                          />
                          <input
                            type="text"
                            maxLength={20}
                            placeholder="よみがな"
                            value={d.nicknameKana}
                            disabled={busyId === item.id}
                            onChange={(e) =>
                              setDraft(item.id, idx, {
                                nicknameKana: e.target.value,
                              })
                            }
                            onBlur={() => saveNicknames(item)}
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-1">
          <CartSummary
            subtotal={cart.subtotal}
            actionLabel="レジに進む"
            actionHref={canCheckout ? "/checkout" : undefined}
            onAction={
              canCheckout
                ? undefined
                : () =>
                    show(
                      nicknameMissing
                        ? "ニックネーム未入力の商品があります"
                        : "購入できない商品があります",
                      "error",
                    )
            }
            disabled={!canCheckout}
          />
          {nicknameMissing && (
            <p className="mt-3 text-center text-xs text-red-600">
              ニックネームが必要な商品は、数量分すべて入力後にレジへ進めます。
            </p>
          )}
          <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
            <p className="font-medium">⏱ 在庫の確保について</p>
            <p className="mt-1">
              カートに入れた時点では在庫は確保されません。先着順のため、
              「レジに進む」を押した時点から{" "}
              <b>15分以内に決済</b>
              完了されると確保が確定します。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
