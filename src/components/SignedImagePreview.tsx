"use client";

import { useEffect, useRef, useState } from "react";

type DeliveryInfo = {
  deliveryId: string;
  title: string;
  nickname: string | null;
  baseImageUrl: string;
  signaturePngBase64: string;
  downloadFilename: string;
  signatureStatus: "WRITTEN" | "COMPLETED" | "REJECTED";
  deliveryStatus: "PENDING" | "READY" | "CANCELLED" | "REFUNDED" | "FAILED";
};

/**
 * 原本＋サインをブラウザ Canvas で合成して表示するコンポーネント。
 * 「ダウンロード」ボタンで PNG を保存する。
 *
 * 一般ユーザー・管理者の両方で同じコンポーネントを使う。
 * showDownloadButton=true のとき、DLボタンを表示（保存時にDLカウントPOSTを送る）。
 */
export function SignedImagePreview({
  deliveryId,
  showDownloadButton = true,
  countDownload = true,
}: {
  deliveryId: string;
  showDownloadButton?: boolean;
  countDownload?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [info, setInfo] = useState<DeliveryInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1. info APIを叩いて原本URL+サインbase64を取得
  useEffect(() => {
    let aborted = false;
    setError(null);
    setReady(false);
    fetch(`/api/deliveries/${deliveryId}/info`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (aborted) return;
        setInfo(json.data);
      })
      .catch((e) => {
        if (aborted) return;
        setError(e instanceof Error ? e.message : "取得に失敗しました");
      });
    return () => {
      aborted = true;
    };
  }, [deliveryId]);

  // 2. 取得後、原本＋サインを canvas に描画
  useEffect(() => {
    if (!info) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const original = new Image();
    // 自ドメイン相対URLのときは crossOrigin をつけない。
    // つけると同一オリジンでもブラウザが Access-Control-Allow-Origin を要求し、
    // Next.js の Route Handler が既定でヘッダを付けていない場合に読み込みが失敗する。
    // 外部URL (http/https 絶対URL) のときだけ anonymous を指定して canvas 汚染を回避する。
    const isAbsolute = /^https?:\/\//i.test(info.baseImageUrl);
    if (isAbsolute) original.crossOrigin = "anonymous";
    original.onload = () => {
      const sig = new Image();
      sig.onload = () => {
        canvas.width = original.naturalWidth;
        canvas.height = original.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(original, 0, 0);
        // サインPNGを原本サイズに引き伸ばして重ねる（縦横比保持で contain）
        const sw = sig.naturalWidth;
        const sh = sig.naturalHeight;
        const scale = Math.min(canvas.width / sw, canvas.height / sh);
        const dw = sw * scale;
        const dh = sh * scale;
        const dx = (canvas.width - dw) / 2;
        const dy = (canvas.height - dh) / 2;
        ctx.drawImage(sig, dx, dy, dw, dh);
        setReady(true);
      };
      sig.onerror = () => setError("サイン画像を表示できませんでした");
      sig.src = `data:image/png;base64,${info.signaturePngBase64}`;
    };
    original.onerror = () => {
      // 原因切り分けのために、実際の HTTP レスポンスを確認する
      fetch(info.baseImageUrl, { credentials: "same-origin" })
        .then(async (r) => {
          const body = await r.text().catch(() => "");
          setError(
            `原本画像を表示できませんでした (HTTP ${r.status}${body ? ` / ${body}` : ""})`,
          );
        })
        .catch(() => {
          setError("原本画像を表示できませんでした（ネットワークエラー）");
        });
    };
    original.src = info.baseImageUrl;
  }, [info]);

  async function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas || !info) return;
    setSaving(true);
    try {
      // toBlob 経由でDLしてメモリ効率を確保
      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve();
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = info.downloadFilename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          resolve();
        }, "image/png");
      });
      if (countDownload) {
        try {
          await fetch(`/api/deliveries/${deliveryId}/info`, { method: "POST" });
        } catch {
          // カウント失敗は無視
        }
      }
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!info) {
    return (
      <div className="py-12 text-center text-gray-400">読み込み中…</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
        <canvas ref={canvasRef} className="h-auto w-full block" />
      </div>
      {showDownloadButton && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            「{info.nickname ?? "宛名なし"}」さんへ — {info.title}
          </p>
          <button
            onClick={downloadPng}
            disabled={!ready || saving}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "保存中…" : "PNGをダウンロード"}
          </button>
        </div>
      )}
    </div>
  );
}
