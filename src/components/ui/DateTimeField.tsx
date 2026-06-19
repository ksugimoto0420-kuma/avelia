"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * 年月日＋時刻を 1 画面で完結する日時入力。
 *
 * - 普段はテキスト入力（"2026-06-19 14:35" 形式）として表示。
 * - 右のカレンダーアイコンで月カレンダー＋時/分スピナーをポップオーバー表示。
 * - 分は 1 分単位（type=number, step=1）で自由入力。
 *
 * 内部 hidden input で "YYYY-MM-DDTHH:mm" 形式を保持。サーバ側
 * (Server Action / API) は変更不要で互換のまま。
 *
 * - 制御モード: value/onChange
 * - 非制御モード: defaultValue
 */

type Parts = { y: number; mo: number; d: number; h: number; mi: number };

const DAY_OF_WEEK = ["日", "月", "火", "水", "木", "金", "土"];

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

function toInputString(p: Parts | null): string {
  if (!p) return "";
  return `${p.y}-${pad(p.mo)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}`;
}

function toFormValue(p: Parts | null): string {
  if (!p) return "";
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** "YYYY-MM-DDTHH:mm" または "YYYY-MM-DD HH:mm" を厳密に parse。 */
function parseValue(raw: string | null | undefined): Parts | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  if (
    Number.isNaN(y) ||
    Number.isNaN(mo) ||
    Number.isNaN(d) ||
    Number.isNaN(h) ||
    Number.isNaN(mi)
  )
    return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  if (h < 0 || h > 23) return null;
  if (mi < 0 || mi > 59) return null;
  return { y, mo, d, h, mi };
}

/** ユーザー入力 "2026-06-19 14:35" / "2026/06/19 14:35" / "T" 区切りを許容して parse。 */
function parseUserInput(raw: string): Parts | null {
  if (!raw.trim()) return null;
  const norm = raw
    .trim()
    .replace(/\//g, "-")
    .replace(/[Tt]/g, " ")
    .replace(/\s+/g, " ");
  return parseValue(norm);
}

function daysInMonth(y: number, mo: number): number {
  return new Date(y, mo, 0).getDate();
}

function firstWeekday(y: number, mo: number): number {
  return new Date(y, mo - 1, 1).getDay();
}

const baseInputCls =
  "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-gray-100";

export function DateTimeField({
  name,
  value: controlledValue,
  onChange,
  defaultValue = "",
  id,
  required,
  disabled,
}: {
  /** name は hidden input 用。Server Action / GET form 送信に利用 */
  name?: string;
  /** 制御モードの値（YYYY-MM-DDTHH:mm） */
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const isControlled = controlledValue != null;
  const initialParts = useMemo(
    () => parseValue(isControlled ? controlledValue : defaultValue),
    [isControlled, controlledValue, defaultValue],
  );
  const [parts, setParts] = useState<Parts | null>(initialParts);
  const [text, setText] = useState<string>(toInputString(initialParts));
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // 制御モード: props 同期
  useEffect(() => {
    if (!isControlled) return;
    const next = parseValue(controlledValue ?? "");
    setParts(next);
    setText(toInputString(next));
  }, [isControlled, controlledValue]);

  // 非制御モード: defaultValue が変わったら同期
  useEffect(() => {
    if (isControlled) return;
    const next = parseValue(defaultValue);
    setParts(next);
    setText(toInputString(next));
  }, [defaultValue, isControlled]);

  // 外側クリックでポップオーバーを閉じる
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commit(next: Parts | null) {
    setParts(next);
    setText(toInputString(next));
    onChange?.(toFormValue(next));
  }

  function onTextBlur() {
    if (text.trim() === "") {
      commit(null);
      return;
    }
    const p = parseUserInput(text);
    if (p) commit(p);
    else setText(toInputString(parts));
  }

  function patch(patchObj: Partial<Parts>) {
    const base: Parts = parts ?? {
      y: new Date().getFullYear(),
      mo: new Date().getMonth() + 1,
      d: new Date().getDate(),
      h: 12,
      mi: 0,
    };
    const merged: Parts = { ...base, ...patchObj };
    // 末日チェック（5/31 → 6/31 等の補正）
    const last = daysInMonth(merged.y, merged.mo);
    if (merged.d > last) merged.d = last;
    commit(merged);
  }

  function clear() {
    commit(null);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-stretch gap-2">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={onTextBlur}
          placeholder="例: 2026-06-19 14:35"
          disabled={disabled}
          className={baseInputCls}
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          aria-label="カレンダーを開く"
          title="カレンダーを開く"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:bg-gray-100"
        >
          <CalendarIcon />
        </button>
      </div>

      {name && (
        <input
          type="hidden"
          name={name}
          value={toFormValue(parts)}
          required={required}
        />
      )}

      {open && !disabled && (
        <Popover
          parts={parts}
          onPatch={patch}
          onClear={clear}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function Popover({
  parts,
  onPatch,
  onClear,
  onClose,
}: {
  parts: Parts | null;
  onPatch: (p: Partial<Parts>) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const today = new Date();
  const baseY = parts?.y ?? today.getFullYear();
  const baseMo = parts?.mo ?? today.getMonth() + 1;
  const baseD = parts?.d ?? null;

  const [viewY, setViewY] = useState<number>(baseY);
  const [viewMo, setViewMo] = useState<number>(baseMo);

  useEffect(() => {
    setViewY(baseY);
    setViewMo(baseMo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts?.y, parts?.mo]);

  function prevMonth() {
    if (viewMo === 1) {
      setViewY(viewY - 1);
      setViewMo(12);
    } else {
      setViewMo(viewMo - 1);
    }
  }
  function nextMonth() {
    if (viewMo === 12) {
      setViewY(viewY + 1);
      setViewMo(1);
    } else {
      setViewMo(viewMo + 1);
    }
  }

  const days: (number | null)[] = useMemo(() => {
    const firstW = firstWeekday(viewY, viewMo);
    const last = daysInMonth(viewY, viewMo);
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstW; i++) arr.push(null);
    for (let d = 1; d <= last; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [viewY, viewMo]);

  function pickDay(d: number) {
    onPatch({ y: viewY, mo: viewMo, d });
  }

  function todayPick() {
    const t = new Date();
    onPatch({
      y: t.getFullYear(),
      mo: t.getMonth() + 1,
      d: t.getDate(),
      h: t.getHours(),
      mi: t.getMinutes(),
    });
    setViewY(t.getFullYear());
    setViewMo(t.getMonth() + 1);
  }

  const h = parts?.h ?? 12;
  const mi = parts?.mi ?? 0;

  return (
    <div className="absolute right-0 z-30 mt-2 w-[20rem] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
          aria-label="前の月"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-gray-800">
          {viewY}年 {viewMo}月
        </p>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
          aria-label="次の月"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-xs text-gray-500">
        {DAY_OF_WEEK.map((w, i) => (
          <div
            key={w}
            className={
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : ""
            }
          >
            {w}
          </div>
        ))}
        {days.map((d, idx) => {
          if (d == null) return <div key={idx} />;
          const isToday =
            today.getFullYear() === viewY &&
            today.getMonth() + 1 === viewMo &&
            today.getDate() === d;
          const isSelected =
            parts && baseY === viewY && baseMo === viewMo && baseD === d;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => pickDay(d)}
              className={
                "h-8 rounded-md text-sm transition " +
                (isSelected
                  ? "bg-brand-600 text-white"
                  : isToday
                    ? "border border-brand-300 text-brand-700 hover:bg-brand-50"
                    : "text-gray-700 hover:bg-gray-100")
              }
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
        <span className="text-xs font-medium text-gray-500">時刻</span>
        <input
          type="number"
          min={0}
          max={23}
          value={h}
          onChange={(e) => {
            const n = Math.max(0, Math.min(23, Number(e.target.value)));
            if (!Number.isNaN(n)) onPatch({ h: n });
          }}
          aria-label="時"
          title="時"
          className="h-9 w-16 rounded-lg border border-gray-300 bg-white px-2 text-center text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <span className="text-sm text-gray-500">:</span>
        <input
          type="number"
          min={0}
          max={59}
          step={1}
          value={mi}
          onChange={(e) => {
            const n = Math.max(0, Math.min(59, Number(e.target.value)));
            if (!Number.isNaN(n)) onPatch({ mi: n });
          }}
          aria-label="分"
          title="分"
          className="h-9 w-16 rounded-lg border border-gray-300 bg-white px-2 text-center text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button
          type="button"
          onClick={todayPick}
          className="ml-auto h-9 rounded-lg border border-gray-300 px-3 text-xs text-gray-600 hover:bg-gray-50"
        >
          今すぐ
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            onClear();
            onClose();
          }}
          className="text-xs text-gray-500 hover:underline"
        >
          クリア
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700"
        >
          決定
        </button>
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
