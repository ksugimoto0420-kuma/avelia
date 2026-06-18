"use client";

import { useState } from "react";
import { CsvPreviewBar } from "@/components/admin/CsvPreviewBar";

type Source = "all" | "in_house" | "warehouse";
type Format = "standard" | "yamato";

const SOURCES: { value: Source; label: string; sub: string }[] = [
  {
    value: "all",
    label: "すべての発送対象",
    sub: "手元出荷・倉庫出荷を区別せずすべて出力",
  },
  {
    value: "in_house",
    label: "手元出荷分のみ",
    sub: "ポストカード等、社内で印字・発送する商品",
  },
  {
    value: "warehouse",
    label: "倉庫出荷分のみ（新潟・佐川）",
    sub: "倉庫に在庫を持っている商品（写真集・雑誌等）",
  },
];

const FORMATS: { value: Format; label: string }[] = [
  { value: "standard", label: "標準形式" },
  { value: "yamato", label: "ヤマトB2形式" },
];

export function ShippingListPanel() {
  const [source, setSource] = useState<Source>("all");
  const [format, setFormat] = useState<Format>("standard");

  const baseQs = `source=${source}&format=${format}`;
  const previewUrl = `/api/admin/exports/shipping-list?${baseQs}&preview=1`;
  const downloadUrl = `/api/admin/exports/shipping-list?${baseQs}`;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">発送元</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SOURCES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSource(s.value)}
              className={
                "rounded-xl border p-3 text-left transition " +
                (source === s.value
                  ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                  : "border-gray-200 bg-white hover:border-gray-400")
              }
            >
              <p className="text-sm font-bold text-gray-900">{s.label}</p>
              <p className="mt-1 text-xs text-gray-500">{s.sub}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">出力形式</p>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormat(f.value)}
              className={
                "rounded-full border px-4 py-1.5 text-sm font-medium " +
                (format === f.value
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-brand-400")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        {format === "yamato" && (
          <p className="mt-2 text-xs text-gray-500">
            ヤマトB2クラウド「入力データ」規格の代表項目を含む CSV です。実運用時の
            列順は B2 マスタ仕様に合わせて運用しながら調整します。
          </p>
        )}
      </div>

      <CsvPreviewBar previewUrl={previewUrl} downloadUrl={downloadUrl} />
    </div>
  );
}
