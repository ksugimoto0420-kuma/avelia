"use client";

import { useMemo, useState } from "react";
import { ProductCard, type ProductCardData } from "@/components/user/ProductCard";

export type EventProductRow = {
  card: ProductCardData;
  variantNames: string[];
};

/**
 * イベント詳細の「対象商品（券種一覧）」。
 * バリアント名（メンバー名など）でフィルタできるピル UI を上部に配置し、
 * 選択中のいずれかと一致するバリアントを持つ商品だけを残す。
 */
export function EventProductGrid({ products }: { products: EventProductRow[] }) {
  // ユニークなバリアント名を出現順に収集
  const allVariants = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) for (const v of p.variantNames) set.add(v);
    return Array.from(set);
  }, [products]);

  // 多すぎる時はフィルタ自体を表示しない（フィルタが煩雑にならないように）
  const filterAvailable = allVariants.length >= 2 && allVariants.length <= 40;

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (selected.size === 0) return products;
    return products.filter((p) =>
      p.variantNames.some((v) => selected.has(v)),
    );
  }, [products, selected]);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function clear() {
    setSelected(new Set());
  }

  return (
    <div>
      {filterAvailable && (
        <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500">
              メンバー・種類で絞り込み
            </p>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={clear}
                className="text-xs text-brand-600 hover:underline"
              >
                クリア
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {allVariants.map((name) => {
              const active = selected.has(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggle(name)}
                  aria-pressed={active ? "true" : "false"}
                  className={
                    active
                      ? "rounded-full border-2 border-brand-600 bg-brand-600 px-3 py-1 text-xs font-semibold text-white"
                      : "rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-brand-400 hover:text-brand-600"
                  }
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
          選択した条件に一致する商品はありません
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {filtered.map(({ card }) => (
            <ProductCard key={card.id} product={card} />
          ))}
        </div>
      )}
    </div>
  );
}
