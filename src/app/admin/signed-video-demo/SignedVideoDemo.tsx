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
 *   2) 宛名（ニックネーム）を入力
 *   3) サインを Canvas 描画ボードで書く（Pointer Events、iPad Pencil 圧力対応）
 *   4) 合成プレビュー: <video> + <canvas> で動画 + フレーム + 宛名 + サイン を重ねる
 *   5) ダウンロード（合成済み動画）と「共有 / アルバムに保存」
 *
 * サーバー送信なし。
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

const OUT_WIDTH = 1280;
const OUT_HEIGHT = 720;
const MAX_RECORD_MS = 5 * 60 * 1000; // フェーズ1の上限: 5分

type Step = 1 | 2 | 3 | 4;

export function SignedVideoDemo() {
  const [step, setStep] = useState<Step>(1);

  // 1. 動画
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string>("");

  // 2. 宛名
  const [recipientName, setRecipientName] = useState("");
  const [frameKey, setFrameKey] = useState<FrameVariant["key"]>("pink");

  // 3. サイン
  const [signaturePng, setSignaturePng] = useState<string | null>(null);

  // 4. プレビュー & 結果
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultExt, setResultExt] = useState<"mp4" | "webm">("webm");

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
    if (step === 2 && !recipientName.trim()) {
      setError("宛名を入力してください");
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
    setRecipientName("");
    setSignaturePng(null);
    setResultBlob(null);
    setResultUrl(null);
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
          動画 → 宛名 → サイン → 合成プレビュー → ダウンロード
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
          onSelect={handleVideoSelected}
        />
      )}
      {step === 2 && (
        <Step2Recipient
          recipientName={recipientName}
          setRecipientName={setRecipientName}
          frameKey={frameKey}
          setFrameKey={setFrameKey}
        />
      )}
      {step === 3 && (
        <Step3Signature
          initialPng={signaturePng}
          onConfirm={setSignaturePng}
        />
      )}
      {step === 4 && videoUrl && signaturePng && (
        <Step4Preview
          videoUrl={videoUrl}
          recipientName={recipientName}
          frame={frame}
          signaturePng={signaturePng}
          resultUrl={resultUrl}
          resultBlob={resultBlob}
          resultExt={resultExt}
          setResultUrl={setResultUrl}
          setResultBlob={setResultBlob}
          setResultExt={setResultExt}
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
            合成は動画フレーム デモ と同じく
            Canvas.captureStream() + MediaRecorder で WebM/MP4 として書き出します。
          </li>
          <li>
            iPhone Safari は写真Appに保存できるよう MP4 を優先します。
            iPad/PC はブラウザの対応状況で自動選択されます。
          </li>
          <li>
            本番運用では、ここから S3 等のストレージへアップロード →
            購入者へ配信、という流れを既存のサイン納品の仕組みに乗せて拡張可能です。
          </li>
          <li>
            外部動画（YouTube/Vimeo）の URL を渡しても、ブラウザの CORS 制約により
            合成・ダウンロードはできません。アップロードか自前 CDN 配信のみが
            合成対象になります。
          </li>
        </ul>
      </details>
    </div>
  );
}

function StepNav({ step }: { step: Step }) {
  const labels = ["動画", "宛名", "サイン", "合成"] as const;
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
  onSelect,
}: {
  videoUrl: string | null;
  videoFileName: string;
  onSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <h2 className="text-base font-semibold text-gray-700">
        Step 1: 動画ファイルを選ぶ
      </h2>
      <p className="text-xs text-gray-500">
        スマホ・PC・タブレットの中にある動画を選んでください。サーバーには
        送信されません。長さは 5 分以内を推奨します。
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

/* ----------------------- Step 2 宛名 ----------------------- */

function Step2Recipient({
  recipientName,
  setRecipientName,
  frameKey,
  setFrameKey,
}: {
  recipientName: string;
  setRecipientName: (v: string) => void;
  frameKey: FrameVariant["key"];
  setFrameKey: (k: FrameVariant["key"]) => void;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
      <h2 className="text-base font-semibold text-gray-700">
        Step 2: 宛名とフレーム
      </h2>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">
          宛名（ニックネーム）
        </span>
        <input
          value={recipientName}
          maxLength={20}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="例: ひな"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">フレーム</p>
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
  const strokesRef = useRef<ImageData[]>([]); // 簡易的な undo 用スナップショット
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState(4);
  const [hasDrawn, setHasDrawn] = useState(false);

  // 初期描画: 透明背景
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
    // 点を描いておく
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
        Step 3: サインを描く
      </h2>
      <p className="text-xs text-gray-500">
        タブレットや指で書いてください（iPad Pencil の筆圧にも対応）。
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
          height={400}
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

/* ----------------------- Step 4 プレビュー & 書き出し ----------------------- */

function Step4Preview({
  videoUrl,
  recipientName,
  frame,
  signaturePng,
  resultUrl,
  resultBlob,
  resultExt,
  setResultUrl,
  setResultBlob,
  setResultExt,
  recording,
  setRecording,
  elapsedMs,
  setElapsedMs,
  busy,
  setBusy,
  setError,
  shareNote,
  setShareNote,
  onResetAll,
}: {
  videoUrl: string;
  recipientName: string;
  frame: FrameVariant;
  signaturePng: string;
  resultUrl: string | null;
  resultBlob: Blob | null;
  resultExt: "mp4" | "webm";
  setResultUrl: (v: string | null) => void;
  setResultBlob: (v: Blob | null) => void;
  setResultExt: (v: "mp4" | "webm") => void;
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayImgRef = useRef<HTMLImageElement | null>(null);
  const signImgRef = useRef<HTMLImageElement | null>(null);
  const animRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);

  // フレーム SVG → Image
  useEffect(() => {
    const svg = buildFrameSvg(frame, recipientName, OUT_WIDTH, OUT_HEIGHT);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      overlayImgRef.current = img;
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [frame, recipientName]);

  // サイン Image
  useEffect(() => {
    if (!signaturePng) {
      signImgRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      signImgRef.current = img;
    };
    img.src = signaturePng;
  }, [signaturePng]);

  // unmount で停止
  useEffect(() => {
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
      try {
        recorderRef.current?.stop?.();
      } catch {}
    };
  }, []);

  const drawTick = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = OUT_WIDTH;
    canvas.height = OUT_HEIGHT;

    const tick = () => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw > 0 && vh > 0) {
        // cover で動画を描く
        const r = Math.max(canvas.width / vw, canvas.height / vh);
        const dw = vw * r;
        const dh = vh * r;
        const dx = (canvas.width - dw) / 2;
        const dy = (canvas.height - dh) / 2;
        ctx.drawImage(video, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      // フレーム
      if (overlayImgRef.current) {
        ctx.drawImage(overlayImgRef.current, 0, 0, canvas.width, canvas.height);
      }
      // サイン（右下に配置）
      if (signImgRef.current) {
        const sigW = Math.floor(canvas.width * 0.45);
        const sigH = Math.floor(
          (sigW * signImgRef.current.height) / signImgRef.current.width,
        );
        const margin = Math.floor(canvas.width * 0.04);
        const sx = canvas.width - sigW - margin;
        const sy = canvas.height - sigH - margin - Math.floor(canvas.height * 0.1);
        ctx.drawImage(signImgRef.current, sx, sy, sigW, sigH);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  const startRecord = useCallback(async () => {
    setError(null);
    setShareNote(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
      setResultBlob(null);
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    try {
      video.currentTime = 0;
      await video.play();
    } catch (e) {
      setError(
        "動画の再生に失敗しました: " +
          (e instanceof Error ? e.message : "不明なエラー"),
      );
      return;
    }
    drawTick();

    const canvasStream = canvas.captureStream(30);
    // 動画から音声を取り出して付与
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

    // 動画が終わったら録画停止
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
    drawTick,
    resultUrl,
    setResultUrl,
    setResultBlob,
    setResultExt,
    setRecording,
    setError,
    setShareNote,
    setElapsedMs,
  ]);

  const stopRecord = useCallback(() => {
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch {}
    const v = videoRef.current;
    if (v) v.pause();
  }, []);

  // 経過時間 / 自動停止
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsedMs(ms);
      if (ms >= MAX_RECORD_MS) stopRecord();
    }, 100);
    return () => clearInterval(id);
  }, [recording, stopRecord, setElapsedMs]);

  const downloadVideo = useCallback(() => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `signed-video-${Date.now()}.${resultExt}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [resultUrl, resultExt]);

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
        Step 4: 動画を書き出す
      </h2>
      <p className="text-xs text-gray-500">
        「動画を書き出す」を押すと、元動画を頭から再生しながら裏で
        フレーム + 宛名 + サインを重ねた合成動画を作ります。
        元動画が終わるか、最大 5 分で自動的に書き出しが完了します。
      </p>

      <div className="relative mx-auto aspect-video w-full max-w-2xl overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* 合成は Canvas 側で行う。プレビュー用のオーバーレイは
            録画停止後のサムネに合わせて Canvas を見せる方が安定するため、
            録画中も Canvas を表示する */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
        />
        {recording && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-bold text-white shadow">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
            書き出し中 {(elapsedMs / 1000).toFixed(1)}s
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!recording ? (
          <button
            type="button"
            onClick={startRecord}
            disabled={busy}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            🎬 動画を書き出す
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecord}
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
            src={resultUrl}
            controls
            playsInline
            className="mx-auto w-full max-w-2xl rounded-xl bg-black"
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
              ⬇ ダウンロード（ファイル保存）
            </button>
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
            形式: {resultExt === "mp4" ? "MP4 (H.264/AAC)" : "WebM"}
          </p>
        </div>
      )}
    </section>
  );
}

/* ----------------------- フレーム SVG 生成 ----------------------- */

function buildFrameSvg(
  frame: FrameVariant,
  recipientName: string,
  w: number,
  h: number,
): string {
  const padding = Math.floor(w * 0.04);
  const borderW = Math.floor(w * 0.025);
  const titleSize = Math.floor(w * 0.045);
  const subSize = Math.floor(w * 0.03);
  const cornerR = Math.floor(w * 0.025);
  const greeting = recipientName
    ? `${escapeXml(recipientName)} 様 へ`
    : "あなたへ";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
  <rect x="${borderW / 2}" y="${borderW / 2}" width="${w - borderW}" height="${h - borderW}"
        rx="${cornerR}" ry="${cornerR}"
        fill="none" stroke="${frame.colorBg}" stroke-width="${borderW}" stroke-opacity="0.9"/>
  <rect x="0" y="0" width="${w}" height="${Math.floor(h * 0.14)}" fill="${frame.colorBg}" fill-opacity="0.85"/>
  <text x="${padding}" y="${Math.floor(h * 0.09)}"
        font-family="ui-sans-serif, system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif"
        font-size="${titleSize}" font-weight="900" fill="${frame.colorText}">
    ${escapeXml(frame.emoji)} Avelia FunClub
  </text>
  <text x="${w - padding}" y="${Math.floor(h * 0.09)}"
        text-anchor="end"
        font-family="ui-sans-serif, system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif"
        font-size="${subSize}" font-weight="700" fill="${frame.colorText}" fill-opacity="0.9">
    ${greeting}
  </text>
  <rect x="0" y="${h - Math.floor(h * 0.12)}" width="${w}" height="${Math.floor(h * 0.12)}"
        fill="${frame.colorBg}" fill-opacity="0.85"/>
  <text x="${padding}" y="${h - Math.floor(h * 0.04)}"
        font-family="ui-sans-serif, system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif"
        font-size="${subSize}" font-weight="700" fill="${frame.colorText}">
    ${escapeXml(frame.label)}
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
