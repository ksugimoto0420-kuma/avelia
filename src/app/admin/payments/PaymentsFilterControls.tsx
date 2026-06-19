"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * 決済管理用の即時絞り込み。状態・年月・キーワードを変更するたび
 * router.push でサーバーを再フェッチする。
 *
 * - 年月: 初回マウントで URL に month が無ければ JST 現在年月を自動セット
 * - 年月の「全期間」モードは `month=all` で表現
 * - キーワードは 300ms デバウンス
 *
 * プロバイダは Stripe 固定運用のため UI からは除外。
 */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "すべて" },
  { value: "PENDING", label: "未決済" },
  { value: "AUTHORIZED", label: "与信済" },
  { value: "PAID", label: "決済完了" },
  { value: "FAILED", label: "失敗" },
  { value: "CANCELLED", label: "キャンセル" },
  { value: "REFUNDED", label: "返金済" },
];

export function PaymentsFilterControls({
  defaultMonth,
  currentMonth,
  currentStatus,
  currentQ,
}: {
  defaultMonth: string;
  currentMonth: string;
  currentStatus: string;
  currentQ: string;
}) {
  const router = useRouter();
  const search = useSearchParams();

  const [month, setMonth] = useState<string>(currentMonth || defaultMonth);
  const [status, setStatus] = useState<string>(currentStatus);
  const [q, setQ] = useState<string>(currentQ);

  useEffect(() => {
    const m = search.get("month");
    setMonth(m ?? defaultMonth);
    setStatus(search.get("status") ?? "");
    setQ(search.get("q") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // 初回: URL に month が無ければデフォルト挿入
  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    if (!search.get("month") && defaultMonth) {
      const params = new URLSearchParams(search.toString());
      params.set("month", defaultMonth);
      router.replace(`/admin/payments?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyOverrides(overrides: Record<string, string>) {
    const params = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/admin/payments?${qs}` : "/admin/payments");
  }

  function onMonthChange(v: string) {
    setMonth(v);
    applyOverrides({ month: v });
  }
  function onStatusChange(v: string) {
    setStatus(v);
    applyOverrides({ status: v });
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onQChange(v: string) {
    setQ(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyOverrides({ q: v }), 300);
  }

  function clearAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setMonth("all");
    setStatus("");
    setQ("");
    applyOverrides({ month: "all", status: "", q: "" });
  }

  const showAll = month === "all";
  const dirty =
    status ||
    q ||
    (month && month !== defaultMonth && month !== "all");

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white p-3">
      <Field label="キーワード" htmlFor="payments-q">
        <input
          id="payments-q"
          type="search"
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder="注文番号・メール・外部決済ID"
          className="h-9 w-72 rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </Field>
      <Field label="状態" htmlFor="payments-status">
        <select
          id="payments-status"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-9 w-36 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="支払年月" htmlFor="payments-month">
        <div className="flex items-center gap-2">
          <input
            id="payments-month"
            type="month"
            value={showAll ? "" : month}
            onChange={(e) => onMonthChange(e.target.value)}
            placeholder="例: 2026-06"
            pattern="\d{4}-(0[1-9]|1[0-2])"
            title="YYYY-MM 形式（例: 2026-06）"
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <button
            type="button"
            onClick={() => onMonthChange("all")}
            className={
              "h-9 rounded-lg border px-3 text-xs font-medium " +
              (showAll
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50")
            }
          >
            全期間
          </button>
        </div>
      </Field>
      {dirty && (
        <button
          type="button"
          onClick={clearAll}
          className="h-9 self-end rounded-lg px-3 text-xs text-gray-500 hover:bg-gray-100"
        >
          条件リセット
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}
