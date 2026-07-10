"use client";

import { useRef, useState } from "react";

export type ImageUploadButtonProps = {
  /** アップロード先バケット。商品/イベント画像は "public-assets"、購入者向けは "private-digital" */
  bucket: "public-assets" | "private-digital" | "private-admin";
  /** POST /api/admin/uploads に渡す purpose 文字列 */
  purpose: "product" | "event" | "content" | "delivery-base-image" | "generic";
  /**
   * 対象エンティティのID (省略可)。
   * - product / event: entityId として送信 (未指定なら "new" 扱い)
   * - content / delivery-base-image: contentId として送信
   */
  targetId?: string | null;
  /** アップロード成功時のコールバック。返された Blob URL が渡る */
  onUploaded: (url: string) => void;
  /** ボタンラベル (省略時は「画像をアップロード」) */
  label?: string;
  /** input が受け付ける MIME types */
  accept?: string;
  className?: string;
};

/**
 * 管理画面用のシンプルな画像アップロードボタン。
 *
 * クリック → ファイル選択 → POST /api/admin/uploads → 返ってきた url を親に渡す。
 * 既存の URL 入力欄と並べて使う想定。
 */
export function ImageUploadButton({
  bucket,
  purpose,
  targetId,
  onUploaded,
  label = "画像をアップロード",
  accept = "image/*",
  className,
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPicker = () => {
    setError(null);
    inputRef.current?.click();
  };

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じファイルを連続で選べるようリセット
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("bucket", bucket);
      form.append("purpose", purpose);
      if (purpose === "product" || purpose === "event") {
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
      const url = json.data?.url;
      if (!url) throw new Error("URLが取得できませんでした");
      onUploaded(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onChange}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {uploading ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            アップロード中...
          </>
        ) : (
          <>{label}</>
        )}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
