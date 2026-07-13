"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/**
 * 納品書 一括DL のフィルター + 実行ボタン。
 *
 * ZIP と連結PDF は同じフィルターから切り替え選択。実行は fetch で API を叩き
 * blob 化して window に流し込む形。
 */
export function InvoiceBatchPanel({
  events,
}: {
  events: Array<{ id: string; label: string }>;
}) {
  const { show } = useToast();
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [eventId, setEventId] = useState<string>("");
  const [orderStatus, setOrderStatus] = useState<string>("PAID");
  const [shipmentFilter, setShipmentFilter] = useState<string>("default");
  const [pending, setPending] = useState(false);

  const shipmentStatuses =
    shipmentFilter === "shipping-covered"
      ? ["PREPARING", "SHIPPED", "DELIVERED"]
      : shipmentFilter === "shipped-only"
        ? ["SHIPPED", "DELIVERED"]
        : null;

  const run = async (format: "zip" | "pdf") => {
    setPending(true);
    try {
      const res = await fetch("/api/admin/exports/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to).toISOString() : undefined,
          orderStatuses: orderStatus === "all" ? undefined : [orderStatus],
          shipmentStatuses: shipmentStatuses ?? undefined,
          eventId: eventId || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "生成に失敗しました");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = cd.match(/filename\*=UTF-8''([^;]+)/);
      const filename = filenameMatch
        ? decodeURIComponent(filenameMatch[1])
        : format === "zip"
          ? "納品書.zip"
          : "納品書.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      show("納品書をダウンロードしました");
    } catch (e) {
      show(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">
            注文日 (開始)
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">
            注文日 (終了)
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">
            注文ステータス
          </span>
          <select
            value={orderStatus}
            onChange={(e) => setOrderStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="PAID">PAID (支払済)</option>
            <option value="REFUNDED">REFUNDED (返金済)</option>
            <option value="all">すべて</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">
            発送ステータス
          </span>
          <select
            value={shipmentFilter}
            onChange={(e) => setShipmentFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="default">指定しない (物販以外も含む)</option>
            <option value="shipping-covered">
              PREPARING + SHIPPED + DELIVERED
            </option>
            <option value="shipped-only">SHIPPED + DELIVERED のみ</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs text-gray-500">イベント</span>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">すべて</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        <Button onClick={() => run("zip")} disabled={pending}>
          📦 ZIP でダウンロード
        </Button>
        <Button
          variant="outline"
          onClick={() => run("pdf")}
          disabled={pending}
        >
          📄 連結PDF でダウンロード
        </Button>
        {pending && (
          <span className="text-sm text-gray-500">生成中...</span>
        )}
      </div>
    </div>
  );
}
