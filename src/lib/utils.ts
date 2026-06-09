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

/** 日時表示（日本時間想定の簡易フォーマット） */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("ja-JP", {
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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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
