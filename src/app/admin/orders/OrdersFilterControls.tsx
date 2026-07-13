"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * 注文管理の年月セレクト + テキスト検索。値が変わるたび router.push で
 * 即時反映する（UI 体感としては「JS で絞り込んでいる」状態）。
 *
 * - 年月: select 変更時に即適用。デフォルトは JST 現在年月。"all" は全期間。
 * - テキスト: 300ms デバウンス。
 * - URL に month が無い初回訪問では、デフォルト月を自動で URL に書き込んで
 *   サーバーの絞り込みを開始する。
 */
export function OrdersFilterControls({
  defaultMonth,
  currentMonth,
  currentQ,
  currentEventId = "",
  events = [],
}: {
  defaultMonth: string;
  currentMonth: string; // URL の生 month。"" / "all" / "YYYY-MM" のいずれか
  currentQ: string;
  /** #4: イベント絞り込みで選択中の eventId。空文字なら未選択。 */
  currentEventId?: string;
  /** イベント一覧 (id + 表示ラベル)。管理者向けなので全件で問題ない。 */
  events?: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const search = useSearchParams();

  // 表示用の月 ("" / "all" / "YYYY-MM") と検索文字列
  const [month, setMonth] = useState<string>(currentMonth || defaultMonth);
  const [q, setQ] = useState<string>(currentQ);
  const [eventId, setEventId] = useState<string>(currentEventId);

  // クエリパラメータの変化に追従（status タブ切替やページ遷移時）
  useEffect(() => {
    const m = search.get("month");
    setMonth(m ?? defaultMonth);
    setQ(search.get("q") ?? "");
    setEventId(search.get("eventId") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // 初回マウント: URL に month が無ければデフォルト月を入れて遷移
  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    if (!search.get("month") && defaultMonth) {
      const params = new URLSearchParams(search.toString());
      params.set("month", defaultMonth);
      router.replace(`/admin/orders?${params.toString()}`);
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
    router.push(qs ? `/admin/orders?${qs}` : "/admin/orders");
  }

  function onMonthChange(v: string) {
    setMonth(v);
    applyOverrides({ month: v });
  }

  function onEventChange(v: string) {
    setEventId(v);
    applyOverrides({ eventId: v });
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onQChange(v: string) {
    setQ(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      applyOverrides({ q: v });
    }, 300);
  }

  function clearAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setMonth("all");
    setQ("");
    setEventId("");
    applyOverrides({ month: "all", q: "", eventId: "" });
  }

  // 「全期間」モード or 通常の月入力モードを判定
  const showAll = month === "all";

  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <label
        htmlFor="orders-month"
        className="text-xs font-medium text-gray-600"
      >
        注文年月
      </label>
      <input
        id="orders-month"
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
      {events.length > 0 && (
        <select
          value={eventId}
          onChange={(e) => onEventChange(e.target.value)}
          className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          aria-label="イベント絞り込み"
        >
          <option value="">イベント: 全て</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.label}
            </option>
          ))}
        </select>
      )}
      <input
        type="search"
        value={q}
        onChange={(e) => onQChange(e.target.value)}
        placeholder="注文番号・メール検索"
        className="w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
      {((month && month !== defaultMonth) || q || eventId) && (
        <button
          type="button"
          onClick={clearAll}
          className="h-9 rounded-lg px-3 text-xs text-gray-500 hover:bg-gray-100"
        >
          条件リセット
        </button>
      )}
    </div>
  );
}
