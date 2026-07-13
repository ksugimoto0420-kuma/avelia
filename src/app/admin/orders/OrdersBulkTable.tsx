"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, formatYen } from "@/lib/utils";
import {
  bulkUpdateOrderStatus,
  bulkUpdateShipmentStatus,
  previewBulkStatus,
  type BulkPreview,
  type BulkResult,
} from "./bulk-actions";

/**
 * 一覧テーブル本体 + 選択チェックボックス列 + フッターバー。
 *
 * サーバー側は orders 配列と表示用フィールドだけ渡し、Client で選択状態
 * (Set<orderId>) と一括変更ハンドラを持つ。
 */

export type OrderRow = {
  id: string;
  orderNumber: string;
  userEmail: string;
  total: number;
  status: string;
  paymentStatus: string | null;
  shipmentStatus: string | null;
  createdAt: string; // ISO 文字列 (Server→Client 越えのため)
};

type BulkTarget = "shipment" | "order";
type ShipmentStatusOpt = "PREPARING" | "SHIPPED" | "DELIVERED" | "RETURNED";
type OrderStatusOpt = "CANCELLED" | "REFUNDED";

const SHIPMENT_OPTIONS: Array<{ value: ShipmentStatusOpt; label: string }> = [
  { value: "PREPARING", label: "PREPARING (準備中)" },
  { value: "SHIPPED", label: "SHIPPED (発送済)" },
  { value: "DELIVERED", label: "DELIVERED (お届け済)" },
  { value: "RETURNED", label: "RETURNED (返品)" },
];
const ORDER_OPTIONS: Array<{ value: OrderStatusOpt; label: string }> = [
  { value: "CANCELLED", label: "CANCELLED (未払いキャンセル)" },
  { value: "REFUNDED", label: "REFUNDED (返金済)" },
];

export function OrdersBulkTable({ rows }: { rows: OrderRow[] }) {
  const router = useRouter();
  const { show } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<BulkTarget>("shipment");
  const [shipmentTo, setShipmentTo] = useState<ShipmentStatusOpt>("PREPARING");
  const [orderTo, setOrderTo] = useState<OrderStatusOpt>("CANCELLED");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [pending, startTransition] = useTransition();

  const allChecked = useMemo(
    () => rows.length > 0 && selected.size === rows.length,
    [rows.length, selected.size],
  );
  const someChecked = selected.size > 0 && !allChecked;

  const toggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const orderIds = Array.from(selected);

  const openConfirm = () => {
    // 実行前に事前チェック。適用可能件数と、弾かれる注文の理由を確認モーダルに表示する。
    setResult(null);
    setPreview(null);
    startTransition(async () => {
      try {
        const p = await previewBulkStatus(
          orderIds,
          target,
          target === "shipment" ? shipmentTo : orderTo,
        );
        setPreview(p);
        setConfirmOpen(true);
      } catch (e) {
        show(e instanceof Error ? e.message : "確認に失敗しました");
      }
    });
  };

  const doApply = () => {
    setResult(null);
    startTransition(async () => {
      try {
        const res =
          target === "shipment"
            ? await bulkUpdateShipmentStatus(orderIds, shipmentTo)
            : await bulkUpdateOrderStatus(orderIds, orderTo);
        setResult(res);
        setConfirmOpen(false);
        setPreview(null);
        if (res.failures.length === 0) {
          show(`${res.successCount}件のステータスを更新しました`);
          setSelected(new Set());
        } else {
          show(
            `${res.successCount}件成功 / ${res.failures.length}件失敗しました`,
          );
        }
        router.refresh();
      } catch (e) {
        show(e instanceof Error ? e.message : "更新に失敗しました");
      }
    });
  };

  const targetLabel =
    target === "shipment"
      ? SHIPMENT_OPTIONS.find((o) => o.value === shipmentTo)?.label
      : ORDER_OPTIONS.find((o) => o.value === orderTo)?.label;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <th className="w-10 px-3 py-3 text-left">
                <input
                  type="checkbox"
                  aria-label="全選択"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left">注文番号</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">
                ユーザー
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-right">金額</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">注文</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">決済</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">発送</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">日時</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  注文がありません
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/60">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`選択 ${r.orderNumber}`}
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${r.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {r.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.userEmail}</td>
                  <td className="px-4 py-3 text-right">
                    {formatYen(r.total)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge kind="order" status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    {r.paymentStatus ? (
                      <StatusBadge kind="payment" status={r.paymentStatus} />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.shipmentStatus ? (
                      <StatusBadge kind="shipment" status={r.shipmentStatus} />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {formatDateTime(new Date(r.createdAt))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur shadow-lg">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
            <span className="text-sm font-semibold text-gray-700">
              選択中: {selected.size} 件
            </span>
            <label className="text-xs text-gray-500">対象</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as BulkTarget)}
              className="h-9 rounded-lg border border-gray-300 px-2 text-sm"
            >
              <option value="shipment">発送ステータス</option>
              <option value="order">注文ステータス</option>
            </select>
            <label className="text-xs text-gray-500">新ステータス</label>
            {target === "shipment" ? (
              <select
                value={shipmentTo}
                onChange={(e) =>
                  setShipmentTo(e.target.value as ShipmentStatusOpt)
                }
                className="h-9 rounded-lg border border-gray-300 px-2 text-sm"
              >
                {SHIPMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={orderTo}
                onChange={(e) => setOrderTo(e.target.value as OrderStatusOpt)}
                className="h-9 rounded-lg border border-gray-300 px-2 text-sm"
              >
                {ORDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <Button onClick={openConfirm} disabled={pending}>
              {pending ? "確認中..." : "実行"}
            </Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              選択解除
            </button>
          </div>
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => !pending && setConfirmOpen(false)}
        title="ステータスを一括変更しますか？"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              キャンセル
            </Button>
            <Button
              onClick={doApply}
              disabled={pending || (preview?.applicableCount ?? 0) === 0}
            >
              {pending
                ? "実行中..."
                : preview
                  ? `${preview.applicableCount}件を変更する`
                  : "実行する"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          選択中 {selected.size} 件を「{targetLabel}」に変更しようとしています。
        </p>
        {preview && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-gray-800">
              変更可能: <span className="font-semibold">{preview.applicableCount}件</span>
              {preview.blocked.length > 0 && (
                <>
                  {" / "}
                  変更不可: <span className="font-semibold text-red-700">{preview.blocked.length}件</span>
                </>
              )}
            </p>
            {preview.blocked.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-800">
                  ⚠ 以下は本来あり得ない遷移のためスキップされます。意図した操作か確認してください。
                </p>
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-red-700">
                  {preview.blocked.map((b) => (
                    <li key={b.orderId}>
                      <span className="font-mono">{b.orderNumber}</span>: {b.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {preview.applicableCount === 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                変更可能な注文がありません。対象の選択か新ステータスを見直してください。
              </p>
            )}
          </div>
        )}
      </Modal>

      {result && result.failures.length > 0 && (
        <Modal
          open={true}
          onClose={() => setResult(null)}
          title={`実行結果 (${result.successCount}件成功 / ${result.failures.length}件失敗)`}
          footer={
            <Button variant="outline" onClick={() => setResult(null)}>
              閉じる
            </Button>
          }
        >
          <div className="max-h-72 space-y-1 overflow-auto text-sm">
            {result.failures.map((f) => (
              <p key={f.orderId} className="text-red-700">
                {f.orderId}: {f.reason}
              </p>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
