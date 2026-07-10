"use client";

import { useRef, useState } from "react";

type Bucket = "public-assets" | "private-digital" | "private-admin";
type Purpose =
  | "product"
  | "event"
  | "artist"
  | "kuji-banner"
  | "kuji-prize"
  | "content"
  | "delivery-base-image"
  | "generic";

export type ImageUploadFieldProps = {
  /** form 送信用の input name。Server Component 側から hidden input で送るために必須。 */
  name: string;
  /** 初期値 (アップロード済みURL or 手入力URL)。 */
  defaultValue?: string;
  /** 制御コンポーネント化する場合に使う。指定するとローカル state を使わない。 */
  value?: string;
  /** value を指定した場合の変更ハンドラ。 */
  onChange?: (url: string) => void;
  /** アップロード先バケット。 */
  bucket: Bucket;
  /** アップロード API に渡す purpose。 */
  purpose: Purpose;
  /** 対象エンティティのID (編集時のみ)。 */
  targetId?: string | null;
  /** アップロードエリア上部のラベル。 */
  label?: string;
  /** 「対応形式」等の説明。 */
  hint?: string;
  /**
   * プレビューの表示方法。
   *   - "cover-16-9" : 16:9 カバー (イベントバナー等)
   *   - "square"     : 正方形 (商品サムネイル、アーティスト画像等)
   *   - "auto"       : オリジナル比率
   *   - "none"       : プレビューなし
   */
  previewAspect?: "cover-16-9" | "square" | "auto" | "none";
  /** input が受け付ける MIME (デフォルト image/*)。 */
  accept?: string;
  /** ラッパの追加クラス。 */
  className?: string;
};

/**
 * 管理画面用の統一画像入力フィールド。
 *
 * 上段: ドラッグ&ドロップ or クリックでアップロード
 * 下段: URL 手入力 (補助)
 * 排他制御: どちらか一方を使うと、もう一方は disabled になる。
 * クリアボタンで両方リセット可能。
 *
 * form 送信用に hidden input[name={name}] を出力する。
 * Server Action ベースのフォームでも FormData でこの URL が受け取れる。
 */
export function ImageUploadField({
  name,
  defaultValue = "",
  value: controlledValue,
  onChange,
  bucket,
  purpose,
  targetId = null,
  label = "画像",
  hint = "JPG / PNG / WebP に対応。",
  previewAspect = "cover-16-9",
  accept = "image/*",
  className,
}: ImageUploadFieldProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const url = controlledValue ?? uncontrolled;
  const setUrl = (v: string) => {
    if (onChange) onChange(v);
    else setUncontrolled(v);
  };

  // "uploaded" / "url-input" / null (未確定 or クリア済み)
  const [mode, setMode] = useState<"uploaded" | "url-input" | null>(() => {
    if (!defaultValue) return null;
    return defaultValue.startsWith("http") &&
      !defaultValue.includes("blob.vercel-storage.com")
      ? "url-input"
      : "uploaded";
  });

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const openPicker = () => {
    if (mode === "url-input") return;
    setError(null);
    inputRef.current?.click();
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("bucket", bucket);
      form.append("purpose", purpose);
      if (
        purpose === "product" ||
        purpose === "event" ||
        purpose === "artist" ||
        purpose === "kuji-banner" ||
        purpose === "kuji-prize"
      ) {
        form.append("entityId", targetId ?? "");
      } else {
        form.append("contentId", targetId ?? "");
      }

      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body || "アップロードに失敗しました"}`);
      }
      const json = (await res.json()) as { data?: { url?: string } };
      const uploadedUrl = json.data?.url;
      if (!uploadedUrl) throw new Error("URLが取得できませんでした");
      setUrl(uploadedUrl);
      setMode("uploaded");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const onFilesSelected = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    await upload(file);
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (mode === "url-input") return;
    await onFilesSelected(e.dataTransfer.files);
  };

  const clearAll = () => {
    setUrl("");
    setMode(null);
    setError(null);
  };

  const isUrlInputDisabled = mode === "uploaded";
  const isUploadDisabled = mode === "url-input";

  return (
    <div className={className}>
      {/* 隠し input: form submit 時に値が送信される。JS state を hidden input 経由で反映 */}
      <input type="hidden" name={name} value={url} />

      {/* ラベル */}
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {url && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-gray-500 hover:text-red-600"
          >
            クリア
          </button>
        )}
      </div>

      {/* アップロードエリア */}
      <div
        role="button"
        tabIndex={isUploadDisabled ? -1 : 0}
        aria-disabled={isUploadDisabled}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(e) => {
          if (isUploadDisabled) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (isUploadDisabled) return;
          e.preventDefault();
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition " +
          (isUploadDisabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
            : dragging
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "cursor-pointer border-gray-300 bg-white text-gray-600 hover:border-brand-400 hover:bg-brand-50/40")
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            void onFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />
        {uploading ? (
          <>
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm">アップロード中...</span>
          </>
        ) : (
          <>
            <span className="text-2xl leading-none">
              {isUploadDisabled ? "🔒" : "📷"}
            </span>
            <span className="text-sm font-medium">
              {isUploadDisabled
                ? "URL入力が有効なため無効化されています"
                : "画像をドラッグ&ドロップ、またはクリックして選択"}
            </span>
            <span className="text-xs">{hint}</span>
          </>
        )}
      </div>

      {/* 排他ヒント */}
      <div className="mt-3 text-center text-xs text-gray-500">
        — または、URL を貼り付ける —
      </div>

      {/* URL 手入力 */}
      <input
        type="url"
        value={mode === "uploaded" ? "" : url}
        onChange={(e) => {
          const v = e.target.value;
          setUrl(v);
          setMode(v ? "url-input" : null);
          setError(null);
        }}
        disabled={isUrlInputDisabled}
        placeholder={
          isUrlInputDisabled
            ? "アップロード済みのため無効化されています"
            : "https://…"
        }
        className={
          "mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 " +
          (isUrlInputDisabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
            : "border-gray-300 focus:border-brand-500 focus:ring-brand-200")
        }
      />

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {/* プレビュー */}
      {url && previewAspect !== "none" && (
        <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
          <div
            className={
              previewAspect === "cover-16-9"
                ? "aspect-[16/9] w-full bg-gray-50"
                : previewAspect === "square"
                  ? "aspect-square w-40 bg-gray-50"
                  : "w-full bg-gray-50"
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="プレビュー"
              className={
                previewAspect === "auto"
                  ? "block max-h-64 w-auto"
                  : "h-full w-full object-cover"
              }
            />
          </div>
          <p className="bg-gray-50 px-2 py-1 text-xs text-gray-500">
            プレビュー
            {previewAspect === "cover-16-9" && "（16:9 でトリミング）"}
            {previewAspect === "square" && "（1:1 でトリミング）"}
          </p>
        </div>
      )}
    </div>
  );
}
