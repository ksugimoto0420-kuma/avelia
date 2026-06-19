"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * 「日付」と「時刻（30分刻みのプルダウン）」に分けた使いやすい日時入力。
 *
 * - 内部で hidden input を 1 つ持ち、`YYYY-MM-DDTHH:mm` 形式の値を送信する
 *   ので、サーバ側（既存の Server Action / API）は変更不要
 * - `defaultValue` は `YYYY-MM-DDTHH:mm`（datetime-local 互換）
 * - 「日時クリア」ボタンで空に戻せる（必須でない項目用）
 *
 * 既存の `<input type="datetime-local">` を直接差し替えると、OS 製のドラム式
 * ピッカーで時刻調整がやりづらかった問題を解消する。
 */
const baseInputCls =
  "h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-gray-100";

function buildTimeOptions(stepMinutes = 30) {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += stepMinutes) {
      out.push(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      );
    }
  }
  return out;
}

/** 'YYYY-MM-DDTHH:mm' → { date, time } に分割。値が無い時は空文字。 */
function splitValue(raw: string): { date: string; time: string } {
  if (!raw) return { date: "", time: "" };
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(raw);
  if (!m) return { date: "", time: "" };
  return { date: m[1], time: m[2] };
}

/** 30分刻みから外れる時刻もプルダウンに残せるよう、現在値が無ければ追加 */
function ensureContains(options: string[], extra: string): string[] {
  if (!extra) return options;
  if (options.includes(extra)) return options;
  return [...options, extra].sort();
}

export function DateTimeField({
  name,
  value: controlledValue,
  onChange,
  defaultValue = "",
  id,
  required,
  disabled,
  stepMinutes = 30,
}: {
  /** name は hidden input 用。Server Action / GET form 送信に利用 */
  name?: string;
  /** 制御コンポーネントとして使う時の値（YYYY-MM-DDTHH:mm） */
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  /** 時刻プルダウンの刻み（分）。既定30分。15なども指定可 */
  stepMinutes?: number;
}) {
  const isControlled = controlledValue != null;
  const initial = useMemo(
    () => splitValue(isControlled ? controlledValue : defaultValue),
    [isControlled, controlledValue, defaultValue],
  );
  const [internalDate, setInternalDate] = useState<string>(initial.date);
  const [internalTime, setInternalTime] = useState<string>(initial.time);

  // 制御モードでは props の value から都度算出する。非制御モードでは
  // defaultValue が変わった時にだけ追従する（再 mount 等の保険）。
  const { date, time } = useMemo(() => {
    if (isControlled) return splitValue(controlledValue ?? "");
    return { date: internalDate, time: internalTime };
  }, [isControlled, controlledValue, internalDate, internalTime]);

  useEffect(() => {
    if (isControlled) return;
    const next = splitValue(defaultValue);
    setInternalDate(next.date);
    setInternalTime(next.time);
  }, [defaultValue, isControlled]);

  function emit(nextDate: string, nextTime: string) {
    const v =
      nextDate && nextTime
        ? `${nextDate}T${nextTime}`
        : nextDate
          ? `${nextDate}T00:00`
          : "";
    if (isControlled) {
      onChange?.(v);
    } else {
      setInternalDate(nextDate);
      setInternalTime(nextTime);
      onChange?.(v);
    }
  }

  const setDate = (v: string) => emit(v, time);
  const setTime = (v: string) => emit(date, v);

  const timeOptions = useMemo(
    () => ensureContains(buildTimeOptions(stepMinutes), time),
    [stepMinutes, time],
  );

  // hidden input には常に "" or "YYYY-MM-DDTHH:mm"
  // 片方だけ入っている時は時刻 00:00 / 日付なしは空、として扱う
  const hiddenValue =
    date && time
      ? `${date}T${time}`
      : date
        ? `${date}T00:00`
        : "";

  const clear = () => emit("", "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        id={id}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        disabled={disabled}
        title="日付"
        aria-label="日付"
        className={`${baseInputCls} w-40`}
      />
      <select
        aria-label="時刻"
        title="時刻"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        disabled={disabled || !date}
        className={`${baseInputCls} w-24`}
      >
        <option value="">--:--</option>
        {timeOptions.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {(date || time) && !disabled && (
        <button
          type="button"
          onClick={clear}
          className="h-9 rounded-lg px-3 text-xs text-gray-500 hover:bg-gray-100"
        >
          クリア
        </button>
      )}
      {name && (
        <input
          type="hidden"
          name={name}
          value={hiddenValue}
          required={required}
        />
      )}
    </div>
  );
}
