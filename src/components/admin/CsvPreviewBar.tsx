"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Preview = {
  headers: string[];
  rows: (string | number)[][];
  total: number;
};

/**
 * CSV 出力前の件数確認・先頭サンプル表示。
 *
 * - `previewUrl` （例: `/api/admin/exports/shipping-list?source=in_house&preview=1`）
 *   が変わるたび、自動で件数とサンプル行を取得して表示する
 * - 「CSV ダウンロード」ボタンは `downloadUrl` を window.location でリンク開く
 */
export function CsvPreviewBar({
  previewUrl,
  downloadUrl,
  className,
  previewLimit = 10,
}: {
  previewUrl: string;
  downloadUrl: string;
  className?: string;
  previewLimit?: number;
}) {
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const sep = previewUrl.includes("?") ? "&" : "?";
      const res = await fetch(
        `${previewUrl}${sep}previewLimit=${previewLimit}`,
        { signal: ctrl.signal },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "プレビューの取得に失敗しました");
      }
      setData(json.data);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "エラー");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [previewUrl, previewLimit]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  return (
    <div
      className={
        "rounded-xl border border-gray-200 bg-white " + (className ?? "")
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-gray-700">
            出力プレビュー
          </p>
          {loading ? (
            <span className="text-xs text-gray-400">取得中…</span>
          ) : data ? (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              対象 {data.total.toLocaleString()} 行
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            再取得
          </button>
          <a
            href={downloadUrl}
            className={
              "rounded-lg px-4 py-2 text-sm font-bold text-white " +
              (data && data.total > 0
                ? "bg-brand-600 hover:bg-brand-700"
                : "pointer-events-none bg-gray-300")
            }
            aria-disabled={!data || data.total === 0}
          >
            ⬇ CSV をダウンロード
          </a>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        {data ? (
          data.total === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              出力対象がありません
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  {data.headers.map((h, i) => (
                    <th
                      key={`${h}-${i}`}
                      className="whitespace-nowrap px-3 py-2 text-left font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="whitespace-nowrap px-3 py-2 text-gray-700"
                      >
                        {String(cell ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : !loading && !error ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            まだプレビューを読み込んでいません
          </p>
        ) : null}
      </div>

      {data && data.total > data.rows.length && (
        <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
          先頭 {data.rows.length} 件のみ表示しています（実際の CSV には全 {data.total.toLocaleString()} 行が含まれます）
        </p>
      )}
    </div>
  );
}
