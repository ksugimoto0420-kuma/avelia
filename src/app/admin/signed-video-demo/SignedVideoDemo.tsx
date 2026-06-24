"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * サイン入り動画 デモ（単体・ブラウザ完結）。
 *
 * フロー:
 *   1) 動画ファイルをアップロード（Blob URL でブラウザ内保持）
 *   2) フレームを選んでプレビュー（合成後イメージを静止画で確認）
 *   3) サイン（直筆の宛名＋サイン）を Canvas 描画ボードで書く
 *   4) サインの配置位置とサイズを決めて、合成書き出し
 *   5) ダウンロード／共有
 *
 * - 動画の縦横比は元のまま保持（縦動画は縦のまま書き出す）
 * - 宛名はサインに含まれる前提（直筆）。フレーム側に宛名は出さない。
 * - フレーム左下には今日の日付（YYYY.MM.DD）が入る。
 * - サーバー送信なし。
 */

type FrameVariant = {
  key: "pink" | "gold" | "neon";
  label: string;
  colorBg: string;
  colorText: string;
  emoji: string;
};

const FRAMES: FrameVariant[] = [
  {
    key: "pink",
    label: "推しピンク",
    colorBg: "#db2777",
    colorText: "#ffffff",
    emoji: "💖",
  },
  {
    key: "gold",
    label: "お祝いゴールド",
    colorBg: "#d4a017",
    colorText: "#1f2937",
    emoji: "🎉",
  },
  {
    key: "neon",
    label: "LIVEネオン",
    colorBg: "#7c3aed",
    colorText: "#ffffff",
    emoji: "🎤",
  },
];

const PEN_COLORS = ["#111111", "#ffffff", "#dc2626", "#d4a017", "#ec4899"];

const MAX_RECORD_MS = 5 * 60 * 1000; // フェーズ1の上限: 5分

type Step = 1 | 2 | 3 | 4;

type SignPosition =
  | "bottomRight"
  | "bottomCenter"
  | "bottomLeft"
  | "center"
  | "topRight"
  | "topLeft";

const SIGN_POSITIONS: { key: SignPosition; label: string }[] = [
  { key: "bottomRight", label: "右下" },
  { key: "bottomCenter", label: "中央下" },
  { key: "bottomLeft", label: "左下" },
  { key: "center", label: "中央" },
  { key: "topRight", label: "右上" },
  { key: "topLeft", label: "左上" },
];

export function SignedVideoDemo() {
  const [step, setStep] = useState<Step>(1);

  // 1. 動画
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string>("");
  const [videoDimensions, setVideoDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // 2. フレーム
  const [frameKey, setFrameKey] = useState<FrameVariant["key"]>("pink");

  // 3. サイン
  const [signaturePng, setSignaturePng] = useState<string | null>(null);

  // 4. プレビュー & 結果
  const [signPosition, setSignPosition] = useState<SignPosition>("bottomRight");
  const [signSizeRatio, setSignSizeRatio] = useState(0.45); // 動画幅に対する比率
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultExt, setResultExt] = useState<"mp4" | "webm">("webm");
  // 書き出した動画のサムネ用画像（合成プレビューの最初のフレーム PNG）
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);

  // 共通
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const frame = useMemo(
    () => FRAMES.find((f) => f.key === frameKey) ?? FRAMES[0],
    [frameKey],
  );

  // 動画選択
  const handleVideoSelected = useCallback(
    (file: File) => {
      setError(null);
      if (!file.type.startsWith("video/")) {
        setError("動画ファイルを選んでください");
        return;
      }
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setVideoFileName(file.name);
      setVideoDimensions(null);
      // 動画メタを読み込んでサイズを取得
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.playsInline = true;
      v.onloadedmetadata = () => {
        setVideoDimensions({
          width: v.videoWidth,
          height: v.videoHeight,
        });
      };
      v.src = url;
    },
    [videoUrl],
  );

  // unmount で Blob URL 解放
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNext = () => {
    setError(null);
    if (step === 1 && !videoUrl) {
      setError("動画を選択してください");
      return;
    }
    if (step === 3 && !signaturePng) {
      setError("サインを描いてください");
      return;
    }
    if (step < 4) setStep((s) => ((s + 1) as Step));
  };
  const goBack = () => {
    setError(null);
    if (step > 1) setStep((s) => ((s - 1) as Step));
  };

  const resetAll = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setVideoUrl(null);
    setVideoFileName("");
    setVideoDimensions(null);
    setSignaturePng(null);
    setResultBlob(null);
    setResultUrl(null);
    setThumbnailDataUrl(null);
    setShareNote(null);
    setError(null);
    setStep(1);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          サイン入り動画 デモ
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          動画 → フレーム → 直筆サイン → 配置調整 → 書き出し
          までブラウザ完結で体験できるプロトタイプです。
          サーバーには何も保存されません。
        </p>
      </header>

      <StepNav step={step} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <Step1Video
          videoUrl={videoUrl}
          videoFileName={videoFileName}
          videoDimensions={videoDimensions}
          onSelect={handleVideoSelected}
        />
      )}
      {step === 2 && videoUrl && videoDimensions && (
        <Step2Frame
          videoUrl={videoUrl}
          videoDimensions={videoDimensions}
          frameKey={frameKey}
          setFrameKey={setFrameKey}
          frame={frame}
        />
      )}
      {step === 3 && (
        <Step3Signature
          initialPng={signaturePng}
          onConfirm={setSignaturePng}
        />
      )}
      {step === 4 && videoUrl && videoDimensions && signaturePng && (
        <Step4Compose
          videoUrl={videoUrl}
          videoDimensions={videoDimensions}
          frame={frame}
          signaturePng={signaturePng}
          signPosition={signPosition}
          setSignPosition={setSignPosition}
          signSizeRatio={signSizeRatio}
          setSignSizeRatio={setSignSizeRatio}
          resultUrl={resultUrl}
          resultBlob={resultBlob}
          resultExt={resultExt}
          setResultUrl={setResultUrl}
          setResultBlob={setResultBlob}
          setResultExt={setResultExt}
          thumbnailDataUrl={thumbnailDataUrl}
          setThumbnailDataUrl={setThumbnailDataUrl}
          recording={recording}
          setRecording={setRecording}
          elapsedMs={elapsedMs}
          setElapsedMs={setElapsedMs}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          shareNote={shareNote}
          setShareNote={setShareNote}
          onResetAll={resetAll}
        />
      )}

      {/* ステップ移動 */}
      <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1 || busy || recording}
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ← 戻る
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700"
          >
            次へ →
          </button>
        ) : (
          <button
            type="button"
            onClick={resetAll}
            disabled={busy || recording}
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            最初からやり直す
          </button>
        )}
      </div>

      <details className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
        <summary className="cursor-pointer font-semibold text-gray-800">
          このデモについて
        </summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
          <li>
            動画は端末からアップロードされ、ブラウザのメモリ内（Blob URL）でのみ
            扱われます。サーバーには一切送信されません。
          </li>
          <li>
            元動画の縦横比はそのまま保持されます。縦動画なら縦のまま、横動画なら
            横のまま書き出されます。
          </li>
          <li>
            合成は Canvas.captureStream() + MediaRecorder で WebM/MP4 として
            書き出します。iPhone Safari は写真Appに保存できるよう MP4 を優先します。
          </li>
          <li>
            宛名は直筆のサインの中に含めて書く想定です。
            フレーム左下には今日の日付（YYYY.MM.DD）が入ります。
          </li>
        </ul>
      </details>
    </div>
  );
}

function StepNav({ step }: { step: Step }) {
  const labels = ["動画", "フレーム", "サイン", "合成"] as const;
  return (
    <ol className="flex items-center gap-2 text-xs">
      {labels.map((l, i) => {
        const idx = (i + 1) as Step;
        const active = idx === step;
        const done = idx < step;
        return (
          <li key={l} className="flex items-center gap-2">
            <span
              className={
                "inline-flex h-6 w-6 items-center justify-center rounded-full font-bold " +
                (active
                  ? "bg-brand-600 text-white"
                  : done
                    ? "bg-brand-100 text-brand-700"
                    : "bg-gray-100 text-gray-400")
              }
            >
              {idx}
            </span>
            <span
              className={
                "font-medium " +
                (active
                  ? "text-brand-700"
                  : done
                    ? "text-gray-700"
                    : "text-gray-400")
              }
            >
              {l}
            </span>
            {i < labels.length - 1 && (
              <span className="text-gray-300">→</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ----------------------- Step 1 動画 ----------------------- */

function Step1Video({
  videoUrl,
  videoFileName,
  videoDimensions,
  onSelect,
}: {
  videoUrl: string | null;
  videoFileName: string;
  videoDimensions: { width: number; height: number } | null;
  onSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <h2 className="text-base font-semibold text-gray-700">
        Step 1: 動画ファイルを選ぶ
      </h2>
      <p className="text-xs text-gray-500">
        スマホ・PC・タブレットの中にある動画を選んでください。
        サーバーには送信されません。長さは 5 分以内を推奨します。
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-bold text-white hover:bg-gray-800"
      >
        🎞 動画ファイルを選択
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        aria-label="動画ファイルを選択"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
        }}
      />
      {videoUrl && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            選択中: <b>{videoFileName}</b>
            {videoDimensions && (
              <>
                {" "}
                ／ サイズ:{" "}
                <b>
                  {videoDimensions.width} × {videoDimensions.height}
                </b>
                {videoDimensions.height > videoDimensions.width
                  ? "（縦動画）"
                  : "（横動画）"}
              </>
            )}
          </p>
          <video
            src={videoUrl}
            controls
            playsInline
            className="mx-auto w-full max-w-md rounded-xl bg-black"
          />
        </div>
      )}
    </section>
  );
}

/* ----------------------- Step 2 フレーム選択 + プレビュー ----------------------- */

function Step2Frame({
  videoUrl,
  videoDimensions,
  frameKey,
  setFrameKey,
  frame,
}: {
  videoUrl: string;
  videoDimensions: { width: number; height: number };
  frameKey: FrameVariant["key"];
  setFrameKey: (k: FrameVariant["key"]) => void;
  frame: FrameVariant;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [today] = useState(() => formatToday());

  // 動画 1 フレーム + フレーム合成 のプレビュー描画
  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    let cancelled = false;
    const draw = async () => {
      const ctx = c.getContext("2d");
      if (!ctx) return;
      c.width = videoDimensions.width;
      c.height = videoDimensions.height;
      // 動画を表示用に少し進めて 1 フレーム取り出す
      try {
        await new Promise<void>((resolve) => {
          if (v.readyState >= 2) return resolve();
          v.onloadeddata = () => resolve();
          v.onerror = () => resolve();
        });
        if (!cancelled) {
          try {
            v.currentTime = Math.min(0.5, (v.duration || 1) * 0.1);
          } catch {}
          await new Promise<void>((resolve) => {
            v.onseeked = () => resolve();
            setTimeout(resolve, 600);
          });
        }
      } catch {}
      if (cancelled) return;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      // フレーム SVG を読み込んで重ねる
      const svg = buildFrameSvg(frame, today, c.width, c.height);
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    };
    void draw();
    return () => {
      cancelled = true;
    };
  }, [frame, today, videoDimensions]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
      <h2 className="text-base font-semibold text-gray-700">
        Step 2: フレームを選ぶ
      </h2>
      <p className="text-xs text-gray-500">
        フレーム左下には今日の日付（{today}）が入ります。
        宛名はサインに直接書くため、フレームには出ません。
      </p>
      <div className="flex flex-wrap gap-2">
        {FRAMES.map((f) => {
          const active = f.key === frameKey;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFrameKey(f.key)}
              className={
                "rounded-full border-2 px-4 py-1.5 text-sm font-medium transition " +
                (active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-brand-400")
              }
            >
              <span className="mr-1">{f.emoji}</span>
              {f.label}
            </button>
          );
        })}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">
          プレビュー（動画 1 コマ目 + フレーム）
        </p>
        <div className="mx-auto overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            src={videoUrl}
            muted
            playsInline
            preload="auto"
            className="hidden"
          />
          <canvas
            ref={canvasRef}
            className="block h-auto w-full max-w-md mx-auto"
          />
        </div>
      </div>
    </section>
  );
}

/* ----------------------- Step 3 サイン描画 ----------------------- */

function Step3Signature({
  initialPng,
  onConfirm,
}: {
  initialPng: string | null;
  onConfirm: (png: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const strokesRef = useRef<ImageData[]>([]);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState(4);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (initialPng) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, c.width, c.height);
        setHasDrawn(true);
      };
      img.src = initialPng;
    }
  }, [initialPng]);

  const getPos = (
    e: ReactPointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width;
    const sy = c.height / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  const pushSnapshot = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, c.width, c.height);
    strokesRef.current.push(snap);
    if (strokesRef.current.length > 20) strokesRef.current.shift();
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = getPos(e);
    if (!p) return;
    pushSnapshot();
    drawingRef.current = true;
    lastPointRef.current = p;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = penColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, penWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    setHasDrawn(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const p = getPos(e);
    if (!p) return;
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!ctx) return;
    const last = lastPointRef.current ?? p;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    const widthAdj =
      e.pointerType === "pen" ? penWidth * (0.4 + 1.2 * pressure) : penWidth;
    ctx.strokeStyle = penColor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = widthAdj;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    lastPointRef.current = null;
    try {
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const clearAll = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    pushSnapshot();
    ctx.clearRect(0, 0, c.width, c.height);
    setHasDrawn(false);
  };

  const undo = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const snap = strokesRef.current.pop();
    if (!snap) return;
    ctx.putImageData(snap, 0, 0);
  };

  const confirmSign = () => {
    const c = canvasRef.current;
    if (!c) return;
    if (!hasDrawn) {
      onConfirm(null);
      return;
    }
    onConfirm(c.toDataURL("image/png"));
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <h2 className="text-base font-semibold text-gray-700">
        Step 3: 宛名 + サインを描く
      </h2>
      <p className="text-xs text-gray-500">
        宛名（〇〇さんへ など）とサインを直筆で書いてください。
        タブレットや指で書けます（iPad Pencil の筆圧にも対応）。
        書き終わったら下の「サインを確定」を押してください。
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`色 ${c}`}
              onClick={() => setPenColor(c)}
              className={
                "h-7 w-7 rounded-full border-2 " +
                (penColor === c ? "border-gray-900" : "border-gray-200")
              }
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          太さ
          <input
            type="range"
            min={1}
            max={20}
            value={penWidth}
            onChange={(e) => setPenWidth(Number(e.target.value))}
            className="accent-brand-600"
          />
          <span>{penWidth}px</span>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={undo}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            元に戻す
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            全消去
          </button>
        </div>
      </div>
      <div
        className="rounded-xl border border-gray-300 bg-white"
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          width={1200}
          height={500}
          className="block h-auto w-full rounded-xl"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={confirmSign}
          disabled={!hasDrawn}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          サインを確定して保存
        </button>
      </div>
    </section>
  );
}

/* ----------------------- Step 4 合成 & 書き出し ----------------------- */

function computeSignRect(
  position: SignPosition,
  sizeRatio: number,
  canvasW: number,
  canvasH: number,
  signImg: HTMLImageElement,
): { x: number; y: number; w: number; h: number } {
  const w = Math.floor(canvasW * sizeRatio);
  const aspect = signImg.height / signImg.width;
  const h = Math.floor(w * aspect);
  const margin = Math.floor(canvasW * 0.04);
  // 上下バーがあるので、上下に少しオフセット
  const topPad = Math.floor(canvasH * 0.16);
  const bottomPad = Math.floor(canvasH * 0.16);
  switch (position) {
    case "bottomRight":
      return { x: canvasW - w - margin, y: canvasH - h - bottomPad, w, h };
    case "bottomCenter":
      return {
        x: Math.floor((canvasW - w) / 2),
        y: canvasH - h - bottomPad,
        w,
        h,
      };
    case "bottomLeft":
      return { x: margin, y: canvasH - h - bottomPad, w, h };
    case "center":
      return {
        x: Math.floor((canvasW - w) / 2),
        y: Math.floor((canvasH - h) / 2),
        w,
        h,
      };
    case "topRight":
      return { x: canvasW - w - margin, y: topPad, w, h };
    case "topLeft":
      return { x: margin, y: topPad, w, h };
  }
}

function Step4Compose({
  videoUrl,
  videoDimensions,
  frame,
  signaturePng,
  signPosition,
  setSignPosition,
  signSizeRatio,
  setSignSizeRatio,
  resultUrl,
  resultBlob,
  resultExt,
  setResultUrl,
  setResultBlob,
  setResultExt,
  thumbnailDataUrl,
  setThumbnailDataUrl,
  recording,
  setRecording,
  elapsedMs,
  setElapsedMs,
  busy,
  setError,
  shareNote,
  setShareNote,
  onResetAll,
}: {
  videoUrl: string;
  videoDimensions: { width: number; height: number };
  frame: FrameVariant;
  signaturePng: string;
  signPosition: SignPosition;
  setSignPosition: (p: SignPosition) => void;
  signSizeRatio: number;
  setSignSizeRatio: (n: number) => void;
  resultUrl: string | null;
  resultBlob: Blob | null;
  resultExt: "mp4" | "webm";
  setResultUrl: (v: string | null) => void;
  setResultBlob: (v: Blob | null) => void;
  setResultExt: (v: "mp4" | "webm") => void;
  thumbnailDataUrl: string | null;
  setThumbnailDataUrl: (v: string | null) => void;
  recording: boolean;
  setRecording: (v: boolean) => void;
  elapsedMs: number;
  setElapsedMs: (v: number) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  shareNote: string | null;
  setShareNote: (v: string | null) => void;
  onResetAll: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const outCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const signImgRef = useRef<HTMLImageElement | null>(null);
  const animRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const [today] = useState(() => formatToday());

  // フレーム SVG → Image
  useEffect(() => {
    const svg = buildFrameSvg(
      frame,
      today,
      videoDimensions.width,
      videoDimensions.height,
    );
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      frameImgRef.current = img;
      void drawStillPreview();
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, today, videoDimensions]);

  // サイン Image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      signImgRef.current = img;
      void drawStillPreview();
    };
    img.src = signaturePng;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signaturePng]);

  // 配置/サイズが変わるたびに静止プレビューを再描画
  useEffect(() => {
    void drawStillPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signPosition, signSizeRatio]);

  const drawStillPreview = useCallback(async () => {
    const v = videoRef.current;
    const c = previewCanvasRef.current;
    if (!v || !c) return;
    c.width = videoDimensions.width;
    c.height = videoDimensions.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // 動画 1 コマ目を描く
    try {
      if (v.readyState < 2) {
        await new Promise<void>((resolve) => {
          v.onloadeddata = () => resolve();
          setTimeout(resolve, 800);
        });
      }
      try {
        v.currentTime = Math.min(0.5, (v.duration || 1) * 0.1);
      } catch {}
      await new Promise<void>((resolve) => {
        v.onseeked = () => resolve();
        setTimeout(resolve, 600);
      });
    } catch {}
    ctx.drawImage(v, 0, 0, c.width, c.height);
    if (frameImgRef.current) {
      ctx.drawImage(frameImgRef.current, 0, 0, c.width, c.height);
    }
    if (signImgRef.current) {
      const rect = computeSignRect(
        signPosition,
        signSizeRatio,
        c.width,
        c.height,
        signImgRef.current,
      );
      ctx.drawImage(signImgRef.current, rect.x, rect.y, rect.w, rect.h);
    }
  }, [signPosition, signSizeRatio, videoDimensions]);

  // unmount で停止
  useEffect(() => {
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
      try {
        recorderRef.current?.stop?.();
      } catch {}
    };
  }, []);

  const startCompose = useCallback(async () => {
    setError(null);
    setShareNote(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
      setResultBlob(null);
    }
    const video = videoRef.current;
    const canvas = outCanvasRef.current;
    if (!video || !canvas) return;

    canvas.width = videoDimensions.width;
    canvas.height = videoDimensions.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 描画関数（1コマ分）
    const drawComposite = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (frameImgRef.current) {
        ctx.drawImage(frameImgRef.current, 0, 0, canvas.width, canvas.height);
      }
      if (signImgRef.current) {
        const rect = computeSignRect(
          signPosition,
          signSizeRatio,
          canvas.width,
          canvas.height,
          signImgRef.current,
        );
        ctx.drawImage(signImgRef.current, rect.x, rect.y, rect.w, rect.h);
      }
    };

    // 動画 0 秒地点へ seek してサムネ用フレームを生成
    try {
      video.pause();
      video.currentTime = 0;
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        setTimeout(resolve, 600);
      });
    } catch {}
    drawComposite();
    try {
      const thumb = canvas.toDataURL("image/png");
      setThumbnailDataUrl(thumb);
    } catch {}

    try {
      await video.play();
    } catch (e) {
      setError(
        "動画の再生に失敗しました: " +
          (e instanceof Error ? e.message : "不明なエラー"),
      );
      return;
    }

    // 描画ループ
    const tick = () => {
      drawComposite();
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    const canvasStream = canvas.captureStream(30);
    try {
      const vAny = video as HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      const inStream = vAny.captureStream
        ? vAny.captureStream()
        : vAny.mozCaptureStream
          ? vAny.mozCaptureStream()
          : null;
      if (inStream) {
        inStream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
      }
    } catch {}

    const isSafariOrIOS = (() => {
      if (typeof navigator === "undefined") return false;
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const isSafari =
        /Safari\//.test(ua) && !/Chrome\//.test(ua) && !/Chromium\//.test(ua);
      return isIOS || isSafari;
    })();
    const candidates = isSafariOrIOS
      ? [
          "video/mp4;codecs=h264,aac",
          "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
          "video/mp4",
          "video/webm;codecs=vp9,opus",
          "video/webm",
        ]
      : [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "video/mp4",
        ];
    const mimeType = candidates.find((m) => {
      try {
        return MediaRecorder.isTypeSupported(m);
      } catch {
        return false;
      }
    });

    chunksRef.current = [];
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(canvasStream, { mimeType })
        : new MediaRecorder(canvasStream);
    } catch (e) {
      setError(
        "このブラウザは録画に対応していません: " +
          (e instanceof Error ? e.message : ""),
      );
      return;
    }
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    recorder.onstop = () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
      const finalType = mimeType ?? "video/webm";
      const ext: "mp4" | "webm" = finalType.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type: finalType });
      const url = URL.createObjectURL(blob);
      setResultBlob(blob);
      setResultUrl(url);
      setResultExt(ext);
      setRecording(false);
    };

    const onEnded = () => {
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {}
      video.removeEventListener("ended", onEnded);
    };
    video.addEventListener("ended", onEnded);

    recorder.start(250);
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setRecording(true);
    setElapsedMs(0);
  }, [
    resultUrl,
    setResultUrl,
    setResultBlob,
    setResultExt,
    setRecording,
    setError,
    setShareNote,
    setElapsedMs,
    setThumbnailDataUrl,
    signPosition,
    signSizeRatio,
    videoDimensions,
  ]);

  const stopCompose = useCallback(() => {
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch {}
    const v = videoRef.current;
    if (v) v.pause();
  }, []);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsedMs(ms);
      if (ms >= MAX_RECORD_MS) stopCompose();
    }, 100);
    return () => clearInterval(id);
  }, [recording, stopCompose, setElapsedMs]);

  const downloadVideo = useCallback(() => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `signed-video-${Date.now()}.${resultExt}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [resultUrl, resultExt]);

  const downloadThumbnail = useCallback(() => {
    if (!thumbnailDataUrl) return;
    const a = document.createElement("a");
    a.href = thumbnailDataUrl;
    a.download = `signed-video-thumbnail-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [thumbnailDataUrl]);

  const canShareFile = useCallback(() => {
    if (typeof navigator === "undefined") return false;
    if (!resultBlob) return false;
    const navAny = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
    };
    if (typeof navAny.share !== "function") return false;
    const file = new File([resultBlob], `signed-video.${resultExt}`, {
      type: resultBlob.type,
    });
    if (typeof navAny.canShare === "function") {
      return navAny.canShare({ files: [file] });
    }
    return true;
  }, [resultBlob, resultExt]);

  const shareVideo = useCallback(async () => {
    if (!resultBlob) return;
    setShareNote(null);
    const file = new File(
      [resultBlob],
      `signed-video-${Date.now()}.${resultExt}`,
      { type: resultBlob.type },
    );
    try {
      await navigator.share({
        files: [file],
        title: "Avelia FunClub",
        text: "サイン入り動画",
      });
      if (resultExt === "mp4") {
        setShareNote(
          "共有シートが開きました。『ビデオを保存』を選ぶと写真Appに保存できます。",
        );
      } else {
        setShareNote(
          "共有はできましたが、WebM のため iPhone の写真Appには直接保存できない場合があります。",
        );
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setShareNote(
        "共有に失敗しました: " +
          (e instanceof Error ? e.message : "不明なエラー"),
      );
    }
  }, [resultBlob, resultExt, setShareNote]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
      <h2 className="text-base font-semibold text-gray-700">
        Step 4: 配置を決めて動画を書き出す
      </h2>
      <p className="text-xs text-gray-500">
        サインを置く場所とサイズを決めてください。元動画の縦横比はそのまま
        保持されます。「動画を書き出す」を押すと元動画を頭から再生しながら
        合成動画を作ります。最大 5 分で自動停止します。
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">配置</p>
          <div className="flex flex-wrap gap-1.5">
            {SIGN_POSITIONS.map((p) => {
              const active = signPosition === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSignPosition(p.key)}
                  className={
                    "rounded-md border px-3 py-1 text-xs font-medium " +
                    (active
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:border-brand-400")
                  }
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            サインの大きさ: {Math.round(signSizeRatio * 100)}%
          </span>
          <input
            type="range"
            min={15}
            max={80}
            value={Math.round(signSizeRatio * 100)}
            onChange={(e) => setSignSizeRatio(Number(e.target.value) / 100)}
            className="w-full accent-brand-600"
          />
        </label>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">
          プレビュー（合成イメージ）
        </p>
        <div className="mx-auto overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            src={videoUrl}
            muted
            playsInline
            preload="auto"
            className="hidden"
          />
          {/* 静止プレビュー（配置調整中はこちらを見せる） */}
          {!recording && (
            <canvas
              ref={previewCanvasRef}
              className="block h-auto w-full max-w-md mx-auto"
            />
          )}
          {/* 書き出し中はライブの合成キャンバスを見せる */}
          {recording && (
            <div className="relative">
              <canvas
                ref={outCanvasRef}
                className="block h-auto w-full max-w-md mx-auto"
              />
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-bold text-white shadow">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
                書き出し中 {(elapsedMs / 1000).toFixed(1)}s
              </div>
            </div>
          )}
          {/* 録画してない時用の隠しキャンバス（参照確保のため常時存在させる） */}
          {!recording && <canvas ref={outCanvasRef} className="hidden" />}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!recording ? (
          <button
            type="button"
            onClick={startCompose}
            disabled={busy}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            🎬 動画を書き出す
          </button>
        ) : (
          <button
            type="button"
            onClick={stopCompose}
            className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-bold text-white hover:bg-gray-700"
          >
            ⏹ 書き出しを止める
          </button>
        )}
        {busy && <span className="text-xs text-gray-500">処理中…</span>}
      </div>

      {resultUrl && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
          <p className="text-sm font-semibold text-gray-700">
            書き出した動画（プレビュー）
          </p>
          <video
            key={resultUrl}
            src={resultUrl}
            controls
            playsInline
            poster={thumbnailDataUrl ?? undefined}
            className="mx-auto w-full max-w-md rounded-xl bg-black"
          />
          <div className="flex flex-wrap gap-2">
            {canShareFile() && (
              <button
                type="button"
                onClick={shareVideo}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
              >
                📤 共有 / アルバムに保存
              </button>
            )}
            <button
              type="button"
              onClick={downloadVideo}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700"
            >
              ⬇ 動画をダウンロード
            </button>
            {thumbnailDataUrl && (
              <button
                type="button"
                onClick={downloadThumbnail}
                className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                🖼 サムネイルPNGも保存
              </button>
            )}
            <button
              type="button"
              onClick={onResetAll}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              最初からやり直す
            </button>
          </div>
          {shareNote && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {shareNote}
            </p>
          )}
          <p className="text-xs text-gray-500">
            形式: {resultExt === "mp4" ? "MP4 (H.264/AAC)" : "WebM"} ／ サイズ:{" "}
            {videoDimensions.width} × {videoDimensions.height}
          </p>
          <p className="text-[11px] text-gray-400">
            ※ ブラウザの仕様上、書き出した動画ファイル単体のサムネイルは
            端末によって黒く表示される場合があります。
            「サムネイルPNGも保存」で個別に画像として残せます。
          </p>
        </div>
      )}
    </section>
  );
}

/* ----------------------- フレーム SVG 生成 ----------------------- */

/**
 * フレーム SVG を生成する。
 * - 上部バー: 「💖 Avelia FunClub」（フレーム名は出さない）
 * - 下部バー: 左に今日の日付（YYYY.MM.DD）、右にフレーム名
 * - 宛名はサインに直筆で書かれる前提なので、フレームには出さない。
 */
function buildFrameSvg(
  frame: FrameVariant,
  todayLabel: string,
  w: number,
  h: number,
): string {
  // 縦動画と横動画で文字サイズの基準を変える（小さい辺基準）
  const base = Math.min(w, h);
  const padding = Math.floor(base * 0.04);
  const borderW = Math.floor(base * 0.025);
  const titleSize = Math.floor(base * 0.05);
  const subSize = Math.floor(base * 0.034);
  const cornerR = Math.floor(base * 0.025);
  const headerH = Math.floor(h * 0.1);
  const footerH = Math.floor(h * 0.1);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
  <rect x="${borderW / 2}" y="${borderW / 2}" width="${w - borderW}" height="${h - borderW}"
        rx="${cornerR}" ry="${cornerR}"
        fill="none" stroke="${frame.colorBg}" stroke-width="${borderW}" stroke-opacity="0.9"/>
  <rect x="0" y="0" width="${w}" height="${headerH}" fill="${frame.colorBg}" fill-opacity="0.85"/>
  <text x="${padding}" y="${Math.floor(headerH * 0.7)}"
        font-family="ui-sans-serif, system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif"
        font-size="${titleSize}" font-weight="900" fill="${frame.colorText}">
    ${escapeXml(frame.emoji)} Avelia FunClub
  </text>
  <rect x="0" y="${h - footerH}" width="${w}" height="${footerH}"
        fill="${frame.colorBg}" fill-opacity="0.85"/>
  <text x="${padding}" y="${h - Math.floor(footerH * 0.3)}"
        font-family="ui-sans-serif, system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif"
        font-size="${subSize}" font-weight="700" fill="${frame.colorText}">
    ${escapeXml(todayLabel)}
  </text>
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatToday(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}
