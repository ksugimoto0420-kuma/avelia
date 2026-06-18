"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SearchableOption = {
  value: string;
  label: string;
  /** 検索対象に含めたい追加文字列（アーティスト名・カナなど） */
  hint?: string;
};

/**
 * 検索可能なコンボボックス。
 * - 普通の <select> のように value/onChange を持つ
 * - ボタンをクリックするとドロップダウンが開き、テキストで絞り込みできる
 * - フォーム送信のため、隠し <input name=...> に同期する
 *
 * 件数が多くなる選択肢（イベント・商品・アーティスト等）に使う。
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  name,
  placeholder = "選択してください",
  searchPlaceholder = "テキストで絞り込み…",
  emptyMessage = "該当なし",
  allowEmpty = false,
  emptyLabel = "（指定なし）",
  emptyValue = "",
  disabled,
  required,
  id,
}: {
  options: SearchableOption[];
  value: string;
  onChange: (next: string) => void;
  /** 隠し input の name。指定すると Server Action 等から取り出せる */
  name?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** 「指定なし」を選べるか */
  allowEmpty?: boolean;
  emptyLabel?: string;
  emptyValue?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const current = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const blob = `${o.label} ${o.hint ?? ""}`.toLowerCase();
      // スペース区切りで AND 検索
      return q.split(/\s+/).every((w) => blob.includes(w));
    });
  }, [options, query]);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 開いた時に検索欄へフォーカス
  useEffect(() => {
    if (open) {
      // 次のフレームでフォーカス（DOM 反映待ち）
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open ? "true" : "false"}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-sm text-gray-800 hover:border-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-gray-100 disabled:text-gray-400"
      >
        <span className="min-w-0 flex-1 truncate">
          {current ? (
            current.label
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-400"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* フォーム送信用の隠し input。required 指定にも対応 */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required}
        />
      )}

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
        >
          <div className="border-b border-gray-100 p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {allowEmpty && (
              <OptionRow
                label={emptyLabel}
                active={value === emptyValue}
                onClick={() => pick(emptyValue)}
                muted
              />
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-gray-400">
                {emptyMessage}
              </p>
            ) : (
              filtered.map((o) => (
                <OptionRow
                  key={o.value}
                  label={o.label}
                  hint={o.hint}
                  active={o.value === value}
                  onClick={() => pick(o.value)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionRow({
  label,
  hint,
  active,
  muted,
  onClick,
}: {
  label: string;
  hint?: string;
  active: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="option"
      aria-selected={active ? "true" : "false"}
      className={
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm " +
        (active
          ? "bg-brand-50 text-brand-700"
          : muted
            ? "text-gray-500 hover:bg-gray-50"
            : "text-gray-800 hover:bg-gray-50")
      }
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && (
        <span className="truncate text-xs text-gray-400">{hint}</span>
      )}
      {active && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}
