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
  shippingFee: number;
  shippingAmountForFree: number;
  total: number;
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
      window.dispatchEvent(new Event("cart:updated"));
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
      window.dispatchEvent(new Event("cart:updated"));
      show("削除しました");
    } catch (err) {
      show(err instanceof Error ? err.message : "削除失敗", "error");
    } finally {
      setBusyId(null);
    }
  }

  /**
   * 「N個目のニックネームだけ」を削除する。
   * quantity を -1 して、対応する index の unitNickname を配列から抜いた
   * 状態で PATCH する。quantity が 1 の場合はカートアイテム全体を削除する。
   */
  async function removeUnit(item: CartItem, unitIndex: number) {
    if (item.quantity <= 1) {
      await removeItem(item.id);
      return;
    }
    const currentDraft = drafts[item.id] ?? [];
    const units = currentDraft
      .map((d) => ({
        nickname: d.nickname.trim() || null,
        nicknameKana: d.nicknameKana.trim() || null,
      }))
      .filter((_, i) => i !== unitIndex);
    const ok = await patchItem(item.id, {
      quantity: item.quantity - 1,
      unitNicknames: units,
    });
    if (ok) show(`${unitIndex + 1}個目を削除しました`);
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
  const blockedCount = cart.items.filter((i) => !i.purchasable).length;
  const canCheckout = cart.purchasable && !nicknameMissing;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">カート</h1>

      {blockedCount > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠ 購入できない商品が {blockedCount} 件あります。各商品の「カートから削除」を押してから「レジに進む」に進んでください。
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {cart.items.map((item) => {
            const ds = drafts[item.id] ?? [];
            const missing = !item.nicknameSatisfied;
            // 在庫切れ・販売終了など購入不可商品の理由メッセージ
            const blockedReason = !item.purchasable
              ? item.saleStatus === "SOLD_OUT" || item.available <= 0
                ? "在庫切れ"
                : item.saleStatus === "ENDED"
                  ? "販売終了しました"
                  : item.saleStatus === "BEFORE_SALE"
                    ? "まだ販売開始されていません"
                    : item.saleStatus === "UNPUBLISHED"
                      ? "現在公開停止中です"
                      : SALE_STATUS_LABEL[item.saleStatus]
              : null;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${blockedReason ? "border-red-200" : "border-gray-100"}`}
              >
                {blockedReason && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    <span>
                      ⚠ <b>{blockedReason}</b>{" "}
                      のためレジに進めません。カートから削除してください。
                    </span>
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={busyId === item.id}
                      className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      カートから削除
                    </button>
                  </div>
                )}
                <div className="flex gap-3 sm:gap-4">
                  <Link
                    href={`/products/${item.productId}`}
                    className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-50 sm:h-24 sm:w-24"
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

                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/products/${item.productId}`}
                          className="block break-words font-semibold text-gray-900 hover:text-brand-600"
                        >
                          {item.productName}
                        </Link>
                        <p className="text-xs text-gray-500">
                          {item.variantName}
                        </p>
                        <p className="mt-1 text-sm font-bold text-gray-900 sm:hidden">
                          {formatYen(item.lineTotal)}
                        </p>
                      </div>
                      {!item.purchasable && (
                        <Badge color="red">
                          {SALE_STATUS_LABEL[item.saleStatus]}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="font-medium">
                          数量: {item.quantity}
                        </span>
                        {item.requiresNickname && (
                          <span className="text-xs text-gray-400">
                            (下のニックネーム欄の × から個別に削除できます)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="hidden font-bold text-gray-900 sm:block">
                          {formatYen(item.lineTotal)}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={busyId === item.id}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          aria-label="この商品を全て削除"
                        >
                          <TrashIcon />
                          全て削除
                        </button>
                      </div>
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
                      {ds.map((d, idx) => {
                        // 未入力: 保存済みでもドラフトでも空 (どちらかが未入力)
                        const rowMissing =
                          !d.nickname.trim() || !d.nicknameKana.trim();
                        return (
                          <div
                            key={idx}
                            className={`flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1 ${
                              rowMissing
                                ? "border-red-300 bg-red-50/50"
                                : "border-transparent"
                            }`}
                          >
                            {item.quantity >= 2 && (
                              <span className="w-12 shrink-0 text-xs font-medium text-gray-500">
                                {idx + 1}個目
                              </span>
                            )}
                            <input
                              type="text"
                              maxLength={10}
                              placeholder="ニックネーム"
                              value={d.nickname}
                              disabled={busyId === item.id}
                              onChange={(e) =>
                                setDraft(item.id, idx, {
                                  nickname: e.target.value,
                                })
                              }
                              onBlur={() => saveNicknames(item)}
                              className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:text-sm ${
                                !d.nickname.trim()
                                  ? "border-red-300 bg-white"
                                  : "border-gray-300"
                              }`}
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
                              className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:text-sm ${
                                !d.nicknameKana.trim()
                                  ? "border-red-300 bg-white"
                                  : "border-gray-300"
                              }`}
                            />
                            {item.quantity >= 2 && (
                              <button
                                type="button"
                                onClick={() => removeUnit(item, idx)}
                                disabled={busyId === item.id}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                aria-label={`${idx + 1}個目を削除`}
                                title={`${idx + 1}個目を削除`}
                              >
                                <XIcon />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      同じ商品を追加で買う場合は、商品ページの
                      「カートに追加」からもう一度追加してください。
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-1">
          <CartSummary
            subtotal={cart.subtotal}
            shippingFee={cart.shippingFee}
            shippingAmountForFree={cart.shippingAmountForFree}
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

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
