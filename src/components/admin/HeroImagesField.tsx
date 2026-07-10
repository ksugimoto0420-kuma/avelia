"use client";

import { useRef, useState } from "react";

type Props = {
  /** form 送信用の input name (JSON 配列で送る)。 */
  name: string;
  /** 初期値の URL リスト。 */
  defaultValue?: string[];
};

/**
 * トップページのヒーロー画像リスト (複数枚) を管理する専用フィールド。
 * 1枚: 静止画、複数枚: スライダー としてトップに表示される。
 * hidden input に JSON 配列で書き出して form 送信する。
 */
export function HeroImagesField({ name, defaultValue = [] }: Props) {
  const [urls, setUrls] = useState<string[]>(defaultValue);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("bucket", "public-assets");
      form.append("purpose", "generic");
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body || "アップロードに失敗"}`);
      }
      const json = (await res.json()) as { data?: { url?: string } };
      const uploadedUrl = json.data?.url;
      if (!uploadedUrl) throw new Error("URLが取得できませんでした");
      setUrls((prev) => [...prev, uploadedUrl]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const remove = (idx: number) => {
    setUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const move = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= urls.length) return;
    setUrls((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  return (
    <div>
      {/* 送信用 hidden。JSON 配列文字列 */}
      <input type="hidden" name={name} value={JSON.stringify(urls)} />

      <div className="mb-1 flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          ヒーロー画像 ({urls.length} 枚)
        </label>
      </div>
      <p className="mb-2 text-xs text-gray-500">
        1枚だけ登録すると静止画、複数枚だとスライダーとして表示されます。
        推奨: 1600×900px (16:9) の横長画像。
      </p>

      {urls.length > 0 && (
        <ul className="mb-3 space-y-2">
          {urls.map((url, idx) => (
            <li
              key={`${url}-${idx}`}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2"
            >
              <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`ヒーロー ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 text-xs text-gray-500">
                <p className="font-medium text-gray-700">#{idx + 1}</p>
                <p className="truncate">{url}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="上へ"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === urls.length - 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="下へ"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-sm text-red-600 hover:bg-red-50"
                  aria-label="削除"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-brand-400 hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              アップロード中...
            </>
          ) : (
            <>+ 画像を追加</>
          )}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
