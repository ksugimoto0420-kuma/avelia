"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { markDeliveryReady } from "./actions";

/**
 * 納品行のアップロードUI。FileUploader 同様に /api/admin/uploads へ送信し、
 * 取得した key を deliveryId に紐づけて markDeliveryReady を実行する。
 * 行(deliveryId)に固定されているため、ユーザーの取り違えが起きない。
 */
export function DeliveryUploadRow({
  deliveryId,
  isReady,
}: {
  deliveryId: string;
  isReady: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { show } = useToast();
  const [uploading, setUploading] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "アップロード失敗");

      const ready = new FormData();
      ready.append("deliveryId", deliveryId);
      ready.append("fileKey", json.data.key);
      ready.append("originalFilename", file.name);
      await markDeliveryReady(ready);
      show(isReady ? "差し替えました" : "納品しました（購入者へ通知）");
    } catch (err) {
      show(err instanceof Error ? err.message : "エラー", "error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading
          ? "送信中…"
          : isReady
            ? "差し替え"
            : "ファイル納品"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onChange}
      />
    </>
  );
}
