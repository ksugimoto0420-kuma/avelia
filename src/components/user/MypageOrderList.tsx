"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card, CardBody } from "@/components/ui/Card";
import { formatDateTime, formatYen } from "@/lib/utils";

export type MypageOrderItem = {
  id: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
};

export type MypageOrder = {
  id: string;
  orderNumber: string;
  createdAt: string; // ISO
  status: string;
  shipmentStatus: string | null;
  total: number;
  items: MypageOrderItem[];
};

export function MypageOrderList({ orders }: { orders: MypageOrder[] }) {
  const allVariants = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) for (const i of o.items) set.add(i.variantName);
    return Array.from(set);
  }, [orders]);

  const filterAvailable = allVariants.length >= 2 && allVariants.length <= 40;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (selected.size === 0) return orders;
    return orders.filter((o) =>
      o.items.some((i) => selected.has(i.variantName)),
    );
  }, [orders, selected]);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {filterAvailable && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500">
              メンバー・種類で絞り込み
            </p>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
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
          条件に一致する注文はありません
        </p>
      ) : (
        filtered.map((o) => (
          <Card key={o.id}>
            <CardBody>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{o.orderNumber}</p>
                  <p className="text-xs text-gray-400">
                    {formatDateTime(new Date(o.createdAt))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge kind="order" status={o.status} />
                  {o.shipmentStatus && (
                    <StatusBadge kind="shipment" status={o.shipmentStatus} />
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-gray-600">
                {o.items.map((i) => {
                  const highlight = selected.size > 0 && selected.has(i.variantName);
                  return (
                    <li
                      key={i.id}
                      className={
                        "flex justify-between" +
                        (highlight ? " rounded bg-brand-50 px-1" : "")
                      }
                    >
                      <span>
                        {i.productName}（{i.variantName}）× {i.quantity}
                      </span>
                      <span>{formatYen(i.unitPrice * i.quantity)}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
                <Link
                  href={`/mypage/orders/${o.id}`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  注文詳細を見る →
                </Link>
                <span className="font-bold">合計 {formatYen(o.total)}</span>
              </div>
            </CardBody>
          </Card>
        ))
      )}
    </div>
  );
}
