"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";

type Props = {
  deliveryId: string;
  nickname: string | null;
  productName: string;
  eventTitle: string;
  unitLabel: string; // 例: "1/3個目" / ""
  baseImageUrl: string | null; // 原本（背景）画像のURL
  pendingCount: number;
  nextDeliveryId: string | null;
  /** 「← 終了」リンクの行き先（既定: 管理画面の納品一覧） */
  exitHref?: string;
  /** 次の納品への遷移先（既定: /admin/sign-session/[id]） */
  nextHrefPrefix?: string;
  /** 全て完了した時の遷移先（既定: /admin/sign-session/done） */
  doneHref?: string;
  /** サイン送信先 API（既定: 管理者用） */
  submitEndpoint?: string;
};

const PEN_COLORS: { label: string; value: string }[] = [
  { label: "黒", value: "#111111" },
  { label: "白", value: "#FFFFFF" },
  { label: "赤", value: "#DC2626" },
  { label: "青", value: "#1D4ED8" },
  { label: "緑", value: "#059669" },
  { label: "金", value: "#D4A017" },
  { label: "銀", value: "#9CA3AF" },
  { label: "紫", value: "#7C3AED" },
  { label: "ピンク", value: "#DB2777" },
];

const PEN_SIZES: {
  label: string;
  minWidth: number;
  maxWidth: number;
  preview: number;
}[] = [
  { label: "細", minWidth: 0.6, maxWidth: 1.8, preview: 2 },
  { label: "標準", minWidth: 1.2, maxWidth: 3.0, preview: 4 },
  { label: "太", minWidth: 2.0, maxWidth: 4.8, preview: 7 },
  { label: "極太", minWidth: 3.2, maxWidth: 7.2, preview: 10 },
];

export function SignSession({
  deliveryId,
  nickname,
  productName,
  eventTitle,
  unitLabel,
  baseImageUrl,
  pendingCount,
  nextDeliveryId,
  exitHref = "/admin/digital-deliveries",
  nextHrefPrefix = "/admin/sign-session/",
  doneHref = "/admin/sign-session/done",
  submitEndpoint = "/api/admin/signatures",
}: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0].value);
  // 1 = 標準 (PEN_SIZES のインデックス)
  const [penSizeIndex, setPenSizeIndex] = useState<number>(1);

  // 描画キャンバスを「原本画像のサイズに合わせる」（CSS は親に追従、内部解像度は固定）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // HiDPI 対応：内部解像度を CSS サイズ × DPR にして、scale を補正
    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      ctx?.scale(dpr, dpr);
      // 透過背景にするため明示的にクリア
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      padRef.current?.clear();
    };
    resize();
    const initialSize = PEN_SIZES[penSizeIndex];
    const pad = new SignaturePad(canvas, {
      penColor,
      minWidth: initialSize.minWidth,
      maxWidth: initialSize.maxWidth,
      throttle: 8,
      backgroundColor: "rgba(0,0,0,0)", // 透過
    });
    padRef.current = pad;
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      pad.off();
    };
    // 色変更時に再初期化すると描画中の線が消えるので、色だけは別の effect で更新する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryId]);

  // ペン色を即時反映（描画済みの線はそのまま、これから引く線に適用）
  useEffect(() => {
    if (padRef.current) padRef.current.penColor = penColor;
  }, [penColor]);

  // ペン太さも同様に即時反映
  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    const s = PEN_SIZES[penSizeIndex];
    pad.minWidth = s.minWidth;
    pad.maxWidth = s.maxWidth;
  }, [penSizeIndex]);

  function clear() {
    padRef.current?.clear();
  }

  async function submit() {
    setError(null);
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      setError("サインを書いてください");
      return;
    }
    setSubmitting(true);
    try {
      // 透過PNGとして data URL を取得
      const dataUrl = pad.toDataURL("image/png");
      const res = await fetch(submitEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId, dataUrl }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json?.error?.message ?? "送信に失敗しました");
      // 次の納品へ
      if (nextDeliveryId) {
        router.push(`${nextHrefPrefix}${nextDeliveryId}`);
      } else {
        router.push(doneHref);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={exitHref}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 終了
        </Link>
        <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
          残り {pendingCount} 件
        </span>
      </div>

      <div className="mt-4 rounded-2xl bg-brand-50 px-5 py-4">
        <p className="text-xs text-brand-500">{eventTitle}</p>
        <h1 className="text-2xl font-bold text-brand-900">
          「{nickname ?? "宛名なし"}」さんへ
        </h1>
        <p className="mt-1 text-sm text-brand-700">
          {productName} {unitLabel && `／ ${unitLabel}`}
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative mt-5 aspect-[4/3] w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"
      >
        {baseImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={baseImageUrl}
            alt="原本"
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
          />
        )}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ touchAction: "none" }}
        />
      </div>

      {/* カラーパレット */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">ペン色</span>
        {PEN_COLORS.map((c) => {
          const active = penColor === c.value;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => setPenColor(c.value)}
              aria-label={`ペン色 ${c.label}`}
              aria-pressed={active ? "true" : "false"}
              className={`relative h-9 w-9 rounded-full border-2 transition ${
                active
                  ? "border-brand-600 ring-2 ring-brand-200"
                  : "border-gray-300 hover:border-gray-500"
              }`}
              style={{ backgroundColor: c.value }}
            >
              <span className="sr-only">{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* 太さセレクタ */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">太さ</span>
        {PEN_SIZES.map((s, i) => {
          const active = penSizeIndex === i;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => setPenSizeIndex(i)}
              aria-label={`ペン太さ ${s.label}`}
              aria-pressed={active ? "true" : "false"}
              className={`inline-flex h-9 min-w-16 items-center justify-center gap-2 rounded-lg border-2 px-3 text-xs font-semibold transition ${
                active
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-300 bg-white text-gray-600 hover:border-gray-500"
              }`}
            >
              <span
                className="block rounded-full bg-current"
                style={{ width: s.preview, height: s.preview }}
              />
              {s.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={clear}
          disabled={submitting}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          書き直す
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="flex-1 rounded-lg bg-brand-600 px-6 py-3 text-base font-bold text-white hover:bg-brand-700 disabled:opacity-50 sm:flex-initial"
        >
          {submitting ? "送信中…" : "送信して次の方へ →"}
        </button>
      </div>
    </div>
  );
}
