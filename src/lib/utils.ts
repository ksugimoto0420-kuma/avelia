// 汎用ユーティリティ

/** className 結合（条件付きクラスを簡潔に書くため） */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

/** 円表示。内部は整数(円)で保持する想定。 */
export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

// アプリ全体で日本時間を基準にする。Vercel本番（UTC）でもJSTで表示・解釈する。
const APP_TIMEZONE = "Asia/Tokyo";

/** 日時表示（日本時間で固定表示） */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("ja-JP", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ja-JP", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * datetime-local 入力（"2026-06-09T19:40" 等）を日本時間として解釈し
 * UTC基準のDateに変換する。サーバーのTZに依存しない。
 */
export function parseJstDateTimeLocal(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) {
    // フォーマット外でも new Date() で試みる（ISO文字列等）
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, d, h, mi, s] = m;
  // JST は UTC+9
  const utcMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h) - 9,
    Number(mi),
    s ? Number(s) : 0,
  );
  return new Date(utcMs);
}

/** Date を datetime-local input の value 用に「日本時間」で yyyy-MM-ddTHH:mm 文字列化する */
export function toJstDateTimeLocalString(date: Date | null | undefined): string {
  if (!date) return "";
  // JST に変換した各パーツを取り出す
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** JST 基準の現在年月を "YYYY-MM" 形式で返す（R/S 集計やフィルタのデフォルト用） */
export function currentJstPeriod(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

/** ランダムな注文番号を生成（年月 + ランダム英数字） */
export function generateOrderNumber(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AV-${y}${m}-${rand}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w぀-ヿ一-龯-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
