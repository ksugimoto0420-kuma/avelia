// CSV 生成ユーティリティ。Excel で文字化けしないよう UTF-8 BOM を付与する。

function escapeCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** ヘッダ配列と行配列から CSV 文字列を生成する。 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows]
    .map((cols) => cols.map(escapeCell).join(","))
    .join("\r\n");
  return `﻿${lines}`;
}

/** CSV ダウンロード用 Response を生成する。 */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
