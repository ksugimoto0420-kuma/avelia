"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { importInventoriesCsv, type ImportResult } from "./actions";

export function ImportForm() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const r = await importInventoriesCsv(formData);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="CSVをアップロード" subtitle="既存SKUの在庫数を一括更新します" />
        <CardBody className="space-y-4">
          <ul className="space-y-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            <li>
              ・ヘッダ行に <code>sku</code> と <code>quantity</code> が必須（その他列は無視）
            </li>
            <li>
              ・任意で <code>lowStockThreshold</code> 列を含めれば低在庫アラート閾値も同時設定
            </li>
            <li>・SKUが見つからない行はスキップしエラー一覧に出ます</li>
            <li>・現状とquantityが同じ行はスキップ（差分のみ調整履歴に記録）</li>
            <li>
              ・先に
              <Link href="/api/admin/exports/inventories" className="text-brand-600 underline">
                既存在庫をCSV出力
              </Link>
              して、編集→取込が確実です
            </li>
          </ul>
          <form action={onSubmit} className="space-y-3">
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              aria-label="CSVファイル"
              className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "取り込み中…" : "取り込む"}
            </button>
          </form>
        </CardBody>
      </Card>

      {error && (
        <Alert tone="error" title="取り込みに失敗しました">
          {error}
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader title="取込結果" />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-500">対象行</p>
                <p className="text-2xl font-bold text-gray-900">{result.total}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">更新</p>
                <p className="text-2xl font-bold text-green-600">
                  {result.updated}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">エラー</p>
                <p className="text-2xl font-bold text-red-600">
                  {result.errors.length}
                </p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-red-600">
                  エラー詳細
                </p>
                <ul className="max-h-64 space-y-1 overflow-auto rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-700">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      Line {e.line} ({e.sku || "—"}): {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
