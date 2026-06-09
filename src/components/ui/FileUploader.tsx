"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * /api/admin/uploads にファイルを POST し、保存後のキー/URL を返すアップローダ。
 * onUploaded({ key, url }) で結果を受け取る。
 */
export function FileUploader({
  label = "ファイルを選択",
  accept,
  onUploaded,
  className,
}: {
  label?: string;
  accept?: string;
  onUploaded: (result: { key: string; url: string }) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "アップロード失敗");
      onUploaded(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロード失敗");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 text-sm text-gray-600 hover:border-brand-400 hover:bg-brand-50",
          uploading && "opacity-60",
        )}
      >
        {uploading ? "アップロード中…" : `📎 ${label}`}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
      {fileName && !error && (
        <p className="mt-1 text-xs text-gray-500">選択中: {fileName}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
