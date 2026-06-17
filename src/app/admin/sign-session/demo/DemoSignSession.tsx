"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";

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

const DEMO_NICKNAMES = [
  "ひな",
  "ゆい",
  "あおい",
  "みお",
  "さくら",
  "りん",
  "つむぎ",
  "まりあ",
  "ことね",
  "あい",
];

const DEMO_PRODUCTS = [
  "直筆サイン入り写真",
  "オリジナルチェキ",
  "サイン入りポスター",
  "メッセージカード",
  "サイン入りトレカ",
];

const DEMO_EVENTS = [
  "デモ配信 #1 / オンライン特典会",
  "デモ配信 #2 / サイン会",
  "デモ配信 #3 / トレカイベント",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBgUrl() {
  const seed = Math.random().toString(36).slice(2, 10);
  return `https://picsum.photos/seed/${seed}/800/600`;
}

export function DemoSignSession() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0].value);
  const [bgUrl, setBgUrl] = useState<string>(randomBgUrl());
  const [nickname, setNickname] = useState<string>(pick(DEMO_NICKNAMES));
  const [productName, setProductName] = useState<string>(pick(DEMO_PRODUCTS));
  const [eventTitle, setEventTitle] = useState<string>(pick(DEMO_EVENTS));
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // SignaturePad の初期化（resetKey が変わるたびに再生成）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      ctx?.scale(dpr, dpr);
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      padRef.current?.clear();
    };
    resize();
    const pad = new SignaturePad(canvas, {
      penColor,
      minWidth: 1.2,
      maxWidth: 3.0,
      throttle: 8,
      backgroundColor: "rgba(0,0,0,0)",
    });
    padRef.current = pad;
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      pad.off();
    };
    // 色は別 effect で適用するのでここでは依存させない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (padRef.current) padRef.current.penColor = penColor;
  }, [penColor]);

  const clear = useCallback(() => {
    padRef.current?.clear();
  }, []);

  const newScene = useCallback(() => {
    setBgUrl(randomBgUrl());
    setNickname(pick(DEMO_NICKNAMES));
    setProductName(pick(DEMO_PRODUCTS));
    setEventTitle(pick(DEMO_EVENTS));
    setPreviewUrl(null);
    setError(null);
    setResetKey((k) => k + 1);
  }, []);

  // 背景画像とサインを合成してプレビュー＆ダウンロード用 PNG を作る
  const composite = useCallback(async (): Promise<string | null> => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      setError("サインを書いてください");
      return null;
    }
    setError(null);

    const sigDataUrl = pad.toDataURL("image/png");
    // 背景画像を読み込む（crossOrigin を付けて tainted canvas を回避）
    const bg = new Image();
    bg.crossOrigin = "anonymous";
    const sig = new Image();

    const out = document.createElement("canvas");
    out.width = 1200;
    out.height = 900;
    const ctx = out.getContext("2d");
    if (!ctx) return null;

    await new Promise<void>((resolve, reject) => {
      bg.onload = () => resolve();
      bg.onerror = () => reject(new Error("背景画像の読み込みに失敗しました"));
      bg.src = bgUrl;
    });
    // 背景を contain 風に描画（黒帯ではなく白背景）
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    const r = Math.min(out.width / bg.width, out.height / bg.height);
    const w = bg.width * r;
    const h = bg.height * r;
    ctx.drawImage(bg, (out.width - w) / 2, (out.height - h) / 2, w, h);

    await new Promise<void>((resolve, reject) => {
      sig.onload = () => resolve();
      sig.onerror = () => reject(new Error("サインの読み込みに失敗しました"));
      sig.src = sigDataUrl;
    });
    // サインはキャンバス全面に合わせて描画
    ctx.drawImage(sig, 0, 0, out.width, out.height);

    try {
      return out.toDataURL("image/png");
    } catch {
      setError(
        "背景画像のオリジンが画像合成を許可していません。背景を入れ替えてください",
      );
      return null;
    }
  }, [bgUrl]);

  const showPreview = useCallback(async () => {
    const url = await composite();
    if (url) setPreviewUrl(url);
  }, [composite]);

  const downloadPng = useCallback(async () => {
    const url = previewUrl ?? (await composite());
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `demo-signature-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [composite, previewUrl]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/admin/sign-session"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← セッション一覧
        </Link>
        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
          デモ用（保存されません）
        </span>
      </div>

      <div className="mt-4 rounded-2xl bg-brand-50 px-5 py-4">
        <p className="text-xs text-brand-500">{eventTitle}</p>
        <h1 className="text-2xl font-bold text-brand-900">
          「{nickname}」さんへ
        </h1>
        <p className="mt-1 text-sm text-brand-700">{productName}</p>
      </div>

      <div className="relative mt-5 aspect-[4/3] w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={bgUrl}
          src={bgUrl}
          alt="ランダムな背景"
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
          crossOrigin="anonymous"
        />
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

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <button
          onClick={clear}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          書き直す
        </button>
        <button
          onClick={newScene}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          🎲 新しいシーン
        </button>
        <button
          onClick={showPreview}
          className="rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50"
        >
          プレビュー表示
        </button>
        <button
          onClick={downloadPng}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
        >
          PNGダウンロード
        </button>
      </div>

      {previewUrl && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-gray-700">
            合成プレビュー
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="合成プレビュー"
            className="w-full rounded-lg"
          />
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        このページはデモ用です。サインは保存・送信されません。背景画像は
        毎回ランダムに取得されます（picsum.photos）。
      </p>
    </div>
  );
}
