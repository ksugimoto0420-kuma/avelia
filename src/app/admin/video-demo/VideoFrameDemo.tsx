"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 動画フレーム合成デモ。完全クライアント完結。
 *
 * フロー:
 *   1) 「カメラ起動」で getUserMedia
 *   2) 選択中のフレーム SVG をプレビューに重ねる
 *   3) 「録画開始」→ Canvas に毎フレーム動画＋フレームを描画 →
 *      Canvas.captureStream() + MediaRecorder で WebM 出力
 *   4) 録画停止 or 30秒経過で自動停止
 *   5) 「再生」ボタンでその場で確認、「ダウンロード」ボタンで保存
 *
 * 既存システムへの影響: 一切なし（保存・通信なし）。
 */

const FRAMES: { key: string; label: string; colorBg: string; colorText: string; emoji: string }[] = [
  {
    key: "pink",
    label: "推しピンクフレーム",
    colorBg: "#db2777",
    colorText: "#ffffff",
    emoji: "💖",
  },
  {
    key: "gold",
    label: "ゴールド お祝い",
    colorBg: "#d4a017",
    colorText: "#1f2937",
    emoji: "🎉",
  },
  {
    key: "neon",
    label: "ネオン LIVE",
    colorBg: "#7c3aed",
    colorText: "#ffffff",
    emoji: "🎤",
  },
];

const MAX_DURATION_MS = 30_000;
const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1280; // 9:16 縦長（スマホ前提）

export function VideoFrameDemo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playbackRef = useRef<HTMLVideoElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number>(0);

  const [frameKey, setFrameKey] = useState<string>(FRAMES[0].key);
  const [cameraOn, setCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultExt, setResultExt] = useState<"mp4" | "webm">("webm");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const frame = FRAMES.find((f) => f.key === frameKey) ?? FRAMES[0];

  /** フレーム素材 SVG を img として読み込む（描画時の上重ね用） */
  const [frameImg, setFrameImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const svg = buildFrameSvg(frame, VIDEO_WIDTH, VIDEO_HEIGHT);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => setFrameImg(img);
    img.onerror = () => setError("フレーム画像の生成に失敗しました");
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [frame]);

  /**
   * カメラ起動 / 切替。
   * 引数の facing が省略された場合は現在の state（facingMode）を使う。
   * 指定の facingMode が無い端末（PCにアウトカメラ無し等）では
   * フォールバックで facingMode 指定なしで再試行する。
   */
  const startCamera = useCallback(
    async (facing?: "user" | "environment") => {
      const target = facing ?? facingMode;
      setError(null);
      setBusy(true);
      try {
        // 既に起動中なら一度止める（切替時のカメラ占有エラー回避）
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const baseVideo = {
          width: { ideal: VIDEO_WIDTH },
          height: { ideal: VIDEO_HEIGHT },
        } as const;

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { ...baseVideo, facingMode: { ideal: target } },
            audio: true,
          });
        } catch {
          // 指定カメラが無い端末向けフォールバック（PCのアウトカメラ要求など）
          stream = await navigator.mediaDevices.getUserMedia({
            video: baseVideo,
            audio: true,
          });
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setFacingMode(target);
        setCameraOn(true);
      } catch (e) {
        console.error(e);
        setError(
          e instanceof Error
            ? `カメラを起動できませんでした: ${e.message}`
            : "カメラを起動できませんでした",
        );
      } finally {
        setBusy(false);
      }
    },
    [facingMode],
  );

  /** カメラ切替（フロント ⇄ 背面）。録画中は無効。 */
  const switchCamera = useCallback(() => {
    if (recording) return;
    const next = facingMode === "user" ? "environment" : "user";
    startCamera(next);
  }, [facingMode, recording, startCamera]);

  /** カメラ停止 */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  /** unmount で確実に解放 */
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (animationRef.current != null) cancelAnimationFrame(animationRef.current);
      recorderRef.current?.stop?.();
    };
  }, []);

  /** Canvas に動画＋フレームを描画し続ける（録画中のフィード生成） */
  const drawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = VIDEO_WIDTH;
    canvas.height = VIDEO_HEIGHT;

    const tick = () => {
      // 動画をキャンバスにフィットさせる（cover）
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw > 0 && vh > 0) {
        const r = Math.max(canvas.width / vw, canvas.height / vh);
        const dw = vw * r;
        const dh = vh * r;
        const dx = (canvas.width - dw) / 2;
        const dy = (canvas.height - dh) / 2;
        // フロントカメラは左右反転して描く（プレビューと録画結果を一致させる）
        if (facingMode === "user") {
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, canvas.width - dx - dw, dy, dw, dh);
          ctx.restore();
        } else {
          ctx.drawImage(video, dx, dy, dw, dh);
        }
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      // フレームを重ねる（contain で中央配置 / フレームは全面サイズ前提）
      if (frameImg) {
        ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
      }
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
  }, [frameImg, facingMode]);

  /** 録画開始 */
  const startRecording = useCallback(() => {
    setError(null);
    setResultUrl(null);
    if (!streamRef.current || !videoRef.current) {
      setError("先にカメラを起動してください");
      return;
    }
    drawLoop();
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Canvas 自体のストリーム（映像）+ getUserMedia の音声トラック
    const canvasStream = canvas.captureStream(30);
    const audioTracks = streamRef.current.getAudioTracks();
    audioTracks.forEach((t) => canvasStream.addTrack(t));

    chunksRef.current = [];
    // mimeType を順に試す（ブラウザ依存）。
    // iOS Safari は写真Appに WebM を保存できないので、Safari/iOS では
    // MP4(H.264/AAC) を最優先にして「写真に保存」できる動画を出す。
    const isSafariOrIOS = (() => {
      if (typeof navigator === "undefined") return false;
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const isSafari =
        /Safari\//.test(ua) && !/Chrome\//.test(ua) && !/Chromium\//.test(ua);
      return isIOS || isSafari;
    })();
    const mp4First = [
      "video/mp4;codecs=h264,aac",
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
    ];
    const webmFirst = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const candidates = isSafariOrIOS
      ? [...mp4First, ...webmFirst]
      : [...webmFirst, ...mp4First];
    const mimeType = candidates.find((m) => {
      try {
        return MediaRecorder.isTypeSupported(m);
      } catch {
        return false;
      }
    });
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
      if (animationRef.current != null)
        cancelAnimationFrame(animationRef.current);
      const finalType = mimeType ?? "video/webm";
      const ext: "mp4" | "webm" = finalType.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type: finalType });
      const url = URL.createObjectURL(blob);
      setResultBlob(blob);
      setResultExt(ext);
      setResultUrl(url);
      setRecording(false);
    };

    recorder.start(250);
    recorderRef.current = recorder;
    recordingStartedAtRef.current = Date.now();
    setRecording(true);
    setElapsedMs(0);
  }, [drawLoop]);

  /** 録画停止（手動 or 30秒経過） */
  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (animationRef.current != null) cancelAnimationFrame(animationRef.current);
  }, []);

  /** 経過時間表示 / 自動停止のタイマー */
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const ms = Date.now() - recordingStartedAtRef.current;
      setElapsedMs(ms);
      if (ms >= MAX_DURATION_MS) stopRecording();
    }, 100);
    return () => clearInterval(id);
  }, [recording, stopRecording]);

  /** やり直し */
  const reset = useCallback(() => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    setResultBlob(null);
    setError(null);
    setShareNote(null);
  }, [resultUrl]);

  /** ダウンロード */
  const downloadVideo = useCallback(() => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `frame-demo-${frame.key}-${Date.now()}.${resultExt}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [resultUrl, resultExt, frame]);

  /**
   * 共有（iPhoneでアルバムに保存するための導線）。
   * navigator.share に File を渡すと iOS では共有シートが出て
   * 「ビデオを保存」で写真Appに入る。
   * MP4 でないと写真Appが受け付けないので、WebM の場合は説明を出す。
   */
  const canShareFile = useCallback(() => {
    if (typeof navigator === "undefined") return false;
    if (!resultBlob) return false;
    const navAny = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
    };
    if (typeof navAny.share !== "function") return false;
    const file = new File([resultBlob], `frame-demo.${resultExt}`, {
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
      `frame-demo-${frame.key}-${Date.now()}.${resultExt}`,
      { type: resultBlob.type },
    );
    try {
      await navigator.share({
        files: [file],
        title: "Avelia FunClub",
        text: "フレーム動画",
      });
      if (resultExt === "mp4") {
        setShareNote(
          "共有シートが開きました。『ビデオを保存』を選ぶと写真Appに保存できます。",
        );
      } else {
        setShareNote(
          "共有はできましたが、形式が WebM のため iPhone の写真Appには直接保存できない場合があります。MP4 対応端末で再録画するか、『DL』からファイルに保存してください。",
        );
      }
    } catch (e) {
      // ユーザーがキャンセルした場合は静かに無視
      if (e instanceof Error && e.name === "AbortError") return;
      setShareNote(
        "共有に失敗しました: " +
          (e instanceof Error ? e.message : "不明なエラー"),
      );
    }
  }, [resultBlob, resultExt, frame]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          動画フレーム デモ
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          カメラ映像にフレームを重ねて動画を録画 →
          そのままダウンロードまで体験できるプロトタイプです。
          サーバーには何も保存されません（将来 S3 等のストレージ接続で本番運用可）。
        </p>
      </div>

      {/* フレーム選択 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-gray-700">フレーム選択</p>
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

      {/* プレビュー */}
      <div className="rounded-2xl border border-gray-200 bg-black p-4">
        <div className="relative mx-auto aspect-[9/16] max-w-xs overflow-hidden rounded-xl bg-black">
          {/* カメラ素のプレビュー（フロントは鏡像にする） */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={
              "absolute inset-0 h-full w-full object-cover " +
              (facingMode === "user" ? "[transform:scaleX(-1)]" : "")
            }
          />
          {/* フレーム上重ね（プレビュー時は SVG を <img> で重ねるだけ。
              録画時は Canvas に転写される） */}
          {frameImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={frameImg.src}
              alt="frame"
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          )}
          {/* 録画中バッジ */}
          {recording && (
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-bold text-white shadow">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
              REC {(elapsedMs / 1000).toFixed(1)}s
            </div>
          )}
          {!cameraOn && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
              「カメラ起動」を押してください
            </div>
          )}
        </div>
        {/* 録画用 Canvas は隠す（描画は内部のみ） */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* カメラ選択（インカメ / アウトカメ） */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-gray-700">カメラ選択</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "user", label: "🤳 インカメラ（自撮り）" },
              { key: "environment", label: "📷 アウトカメラ（背面）" },
            ] as const
          ).map((opt) => {
            const active = facingMode === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  if (recording) return;
                  if (cameraOn) startCamera(opt.key);
                  else setFacingMode(opt.key);
                }}
                disabled={recording}
                className={
                  "rounded-full border-2 px-4 py-1.5 text-sm font-medium transition disabled:opacity-50 " +
                  (active
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-brand-400")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          ※ 録画中はカメラを切り替えられません。アウトカメラはスマホ・タブレットで有効です。
        </p>
      </div>

      {/* 操作ボタン */}
      <div className="flex flex-wrap items-center gap-3">
        {!cameraOn ? (
          <button
            type="button"
            onClick={() => startCamera()}
            disabled={busy}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            🎥 カメラ起動
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={switchCamera}
              disabled={busy || recording}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              title={recording ? "録画中は切り替えできません" : ""}
            >
              🔄 カメラ切替
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              カメラ停止
            </button>
          </>
        )}
        {cameraOn && !recording && (
          <button
            type="button"
            onClick={startRecording}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700"
          >
            ⏺ 録画開始
          </button>
        )}
        {recording && (
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-bold text-white hover:bg-gray-700"
          >
            ⏹ 停止
          </button>
        )}
        <span className="text-xs text-gray-400">最大 30 秒で自動停止</span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 録画結果 */}
      {resultUrl && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-gray-700">
            録画した動画（プレビュー）
          </p>
          <video
            ref={playbackRef}
            src={resultUrl}
            controls
            className="mx-auto w-full max-w-xs rounded-xl bg-black"
          />
          <div className="mt-3 flex flex-wrap gap-2">
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
              onClick={reset}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              撮り直す
            </button>
          </div>
          {shareNote && (
            <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {shareNote}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            形式: {resultExt === "mp4" ? "MP4 (H.264/AAC)" : "WebM"}
            {" "}・iPhone（Safari）は<b>「共有 / アルバムに保存」</b>から
            <b>「ビデオを保存」</b>で写真Appに入ります。
            Androidは「共有」→「フォト」を選択でアルバムに保存可能。
            PCは「ダウンロード」でファイル保存されます。
          </p>
        </div>
      )}

      {/* 説明 */}
      <details className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
        <summary className="cursor-pointer font-semibold text-gray-800">
          このデモについて
        </summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
          <li>
            カメラ映像 + フレーム SVG を Canvas に毎フレーム描画し、
            Canvas.captureStream() と MediaRecorder API で WebM
            （またはMP4）として録画しています。
          </li>
          <li>
            録画ファイルはブラウザのメモリ（Blob URL）に保持しており、
            サーバーには一切送信されません。
          </li>
          <li>
            本番運用時は、ここから S3 等のストレージへアップロード →
            運営承認 → ユーザーのマイページから DL、という納品フローを
            既存サイン納品の仕組みに乗せて拡張可能です。
          </li>
          <li>
            iOS Safari は HTTPS 必須 + ユーザー操作起因でのみ getUserMedia が
            動きます。今回のデモは HTTPS（Vercel）で配信されているため動作します。
          </li>
          <li>
            写真Appに保存するには MP4(H.264) が必要なため、iPhone/Safari では
            録画形式を自動的に MP4 優先に切替えています。WebM 録画のままだと
            iPhone の写真Appには入りません。
          </li>
          <li>
            「共有 / アルバムに保存」は Web Share API を利用しており、
            ブラウザの共有シート（iOS なら「写真に保存」、Android なら
            「フォト」など）を経由してアルバムに保存します。
          </li>
        </ul>
      </details>
    </div>
  );
}

/** SVG 文字列でフレームを生成。フレーム素材を別管理にせず1ファイル完結。 */
function buildFrameSvg(
  frame: { colorBg: string; colorText: string; emoji: string; label: string },
  w: number,
  h: number,
): string {
  const padding = Math.floor(w * 0.05);
  const borderW = Math.floor(w * 0.04);
  const titleSize = Math.floor(w * 0.07);
  const subSize = Math.floor(w * 0.04);
  const cornerR = Math.floor(w * 0.04);
  // ヘッダー / フッターのバーを上下に置き、ボディは透過枠
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <!-- 全体に枠線 -->
  <rect x="${borderW / 2}" y="${borderW / 2}" width="${w - borderW}" height="${h - borderW}"
        rx="${cornerR}" ry="${cornerR}"
        fill="none" stroke="${frame.colorBg}" stroke-width="${borderW}" stroke-opacity="0.9"/>
  <!-- 上部バー -->
  <rect x="0" y="0" width="${w}" height="${Math.floor(h * 0.12)}" fill="${frame.colorBg}" fill-opacity="0.85"/>
  <text x="${padding}" y="${Math.floor(h * 0.075)}"
        font-family="ui-sans-serif, system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif"
        font-size="${titleSize}" font-weight="900" fill="${frame.colorText}">
    ${escapeXml(frame.emoji)} Avelia FunClub
  </text>
  <!-- 下部バー -->
  <rect x="0" y="${h - Math.floor(h * 0.12)}" width="${w}" height="${Math.floor(h * 0.12)}"
        fill="${frame.colorBg}" fill-opacity="0.85"/>
  <text x="${padding}" y="${h - Math.floor(h * 0.045)}"
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
