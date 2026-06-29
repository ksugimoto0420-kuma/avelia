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
 * サイン入り写真集 デモ（ブラウザ完結）。
 *
 * フェーズ:
 *   1) PDF を選択
 *   2) サムネ一覧からサインを入れるページを選ぶ
 *   3) サインを描く + 位置・サイズ調整
 *   4) 「電子書籍ビューワ」モードで閲覧
 *      - 見開き / 縦スクロール 切替
 *      - ズーム
 *      - サムネ一覧から飛べる
 *
 * 重要: pdfjs-dist は SSR 不可なので useEffect 内で動的 import する。
 */

type Step = 1 | 2 | 3;

type PageRender = {
  pageNumber: number;
  width: number;
  height: number;
  // ページごとの dataURL (PNG)
  dataUrl: string;
};

type SignaturePlacement = {
  pageNumber: number;
  // 0〜1 のページ内相対座標（再レンダリング時にスケール追従）
  xRatio: number;
  yRatio: number;
  // 0〜1 のサイズ（ページ幅に対する比率）
  widthRatio: number;
  // サイン PNG
  imagePng: string;
};

// pdfjs-dist の型を最小限だけ使う（dynamic import するので any 経由）
type PdfDocument = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
};
type PdfPage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    canvas?: HTMLCanvasElement;
  }) => { promise: Promise<void> };
};

const PEN_COLORS = ["#111111", "#ffffff", "#dc2626", "#d4a017", "#ec4899"];

export function PhotobookDemo() {
  const [step, setStep] = useState<Step>(1);

  // 1. PDF
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [pages, setPages] = useState<PageRender[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // 2-3. サイン配置
  const [activePage, setActivePage] = useState<number>(1);
  const [signaturePng, setSignaturePng] = useState<string | null>(null);
  const [placements, setPlacements] = useState<SignaturePlacement[]>([]);
  // 配置中のサイズ・位置
  const [signSizeRatio, setSignSizeRatio] = useState(0.3);

  // 4. ビューワ
  const [viewerMode, setViewerMode] = useState<"spread" | "vertical">("spread");
  const [viewerPage, setViewerPage] = useState(1);
  const [zoom, setZoom] = useState(1);

  // 共通
  const [error, setError] = useState<string | null>(null);

  const handlePdfSelected = useCallback(async (file: File) => {
    setError(null);
    if (file.type !== "application/pdf") {
      setError("PDFファイルを選んでください");
      return;
    }
    setPdfFileName(file.name);
    setPages([]);
    setLoadingPdf(true);
    try {
      // pdfjs-dist を動的 import（SSR 回避）
      const pdfjs = await import("pdfjs-dist");
      // Worker を CDN から動的に読み込む。Next.js のバンドルに含めず、
      // CDN の jsDelivr 経由でロードする（バージョンを揃える）。
      const pdfVer = pdfjs.version;
      const pdfjsAny = pdfjs as unknown as {
        GlobalWorkerOptions: { workerSrc: string };
      };
      pdfjsAny.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfVer}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const doc = (await loadingTask.promise) as unknown as PdfDocument;

      const rendered: PageRender[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        // レンダリング解像度の上限を決める（大きすぎるとメモリ爆発）
        const baseViewport = page.getViewport({ scale: 1 });
        const targetWidth = Math.min(1600, baseViewport.width * 2);
        const scale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        }).promise;
        rendered.push({
          pageNumber: i,
          width: canvas.width,
          height: canvas.height,
          dataUrl: canvas.toDataURL("image/jpeg", 0.85),
        });
      }
      setPages(rendered);
      setActivePage(1);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? `PDFの読込に失敗しました: ${e.message}`
          : "PDFの読込に失敗しました",
      );
    } finally {
      setLoadingPdf(false);
    }
  }, []);

  const goNext = () => {
    setError(null);
    if (step === 1 && pages.length === 0) {
      setError("PDFを選択してください");
      return;
    }
    if (step === 2 && placements.length === 0) {
      setError("少なくとも1ページにサインを置いてください");
      return;
    }
    if (step < 3) setStep((s) => ((s + 1) as Step));
    if (step === 2) {
      // ビューワ初期化
      setViewerPage(1);
      setZoom(1);
    }
  };
  const goBack = () => {
    setError(null);
    if (step > 1) setStep((s) => ((s - 1) as Step));
  };
  const resetAll = () => {
    setPdfFileName("");
    setPages([]);
    setSignaturePng(null);
    setPlacements([]);
    setActivePage(1);
    setError(null);
    setStep(1);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          サイン入り写真集 デモ
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          PDFをアップロード → サインを書く → 電子書籍ビューワで閲覧。
          サーバーには何も送信されません。
          自社開発で電子書籍ビューワがどこまで作れるかの技術検証用です。
        </p>
      </header>

      <StepNav step={step} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <Step1Upload
          pdfFileName={pdfFileName}
          pages={pages}
          loadingPdf={loadingPdf}
          onSelect={handlePdfSelected}
        />
      )}
      {step === 2 && pages.length > 0 && (
        <Step2Sign
          pages={pages}
          activePage={activePage}
          setActivePage={setActivePage}
          signaturePng={signaturePng}
          setSignaturePng={setSignaturePng}
          placements={placements}
          setPlacements={setPlacements}
          signSizeRatio={signSizeRatio}
          setSignSizeRatio={setSignSizeRatio}
        />
      )}
      {step === 3 && pages.length > 0 && (
        <Step3Viewer
          pages={pages}
          placements={placements}
          viewerMode={viewerMode}
          setViewerMode={setViewerMode}
          viewerPage={viewerPage}
          setViewerPage={setViewerPage}
          zoom={zoom}
          setZoom={setZoom}
        />
      )}

      <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1}
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ← 戻る
        </button>
        {step < 3 ? (
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
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
            PDFはブラウザのメモリ内（ArrayBuffer / Blob URL）でのみ扱われ、
            サーバーには一切送信されません。
          </li>
          <li>
            PDFのレンダリングは Mozilla PDF.js (pdfjs-dist) を使用しています。
            Worker は CDN から動的ロードしています。
          </li>
          <li>
            「電子書籍ビューワ」は見開き / 縦スクロール の2モードを切替可。
            ズーム・サムネ一覧・全画面表示に対応しています。
          </li>
          <li>
            大容量PDF（100MB超）はブラウザのメモリ次第で重くなる場合があります。
            iPad/スマホの Safari は特にメモリ制限が厳しいので、ページ数の多い
            写真集では性能を実機で確認してください。
          </li>
          <li>
            本番運用時は S3 等にベース写真集を保存し、認証付きの署名URLで配信、
            サインは別ファイル管理して閲覧時に重ねる、といった構成が想定されます。
          </li>
        </ul>
      </details>
    </div>
  );
}

function StepNav({ step }: { step: Step }) {
  const labels = ["PDF選択", "サイン配置", "ビューワ閲覧"] as const;
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

/* ----------------------- Step 1 PDF アップロード ----------------------- */

function Step1Upload({
  pdfFileName,
  pages,
  loadingPdf,
  onSelect,
}: {
  pdfFileName: string;
  pages: PageRender[];
  loadingPdf: boolean;
  onSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <h2 className="text-base font-semibold text-gray-700">
        Step 1: 写真集PDFを選ぶ
      </h2>
      <p className="text-xs text-gray-500">
        端末内のPDFファイルを選んでください。サーバーには送信されません。
        ページ数が多いほど読込・サムネ生成に時間がかかります。
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loadingPdf}
        className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loadingPdf ? "読込中…" : "📕 PDFファイルを選択"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        aria-label="PDFファイルを選択"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
        }}
      />
      {pdfFileName && (
        <p className="text-xs text-gray-500">
          選択中: <b>{pdfFileName}</b> ／ ページ数: <b>{pages.length}</b>
        </p>
      )}
      {pages.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {pages.slice(0, 10).map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.pageNumber}
              src={p.dataUrl}
              alt={`page ${p.pageNumber}`}
              className="aspect-[3/4] w-full rounded border border-gray-200 object-contain"
            />
          ))}
          {pages.length > 10 && (
            <div className="flex aspect-[3/4] w-full items-center justify-center rounded border border-gray-200 bg-gray-50 text-xs text-gray-500">
              +{pages.length - 10}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ----------------------- Step 2 サイン描画と配置 ----------------------- */

function Step2Sign({
  pages,
  activePage,
  setActivePage,
  signaturePng,
  setSignaturePng,
  placements,
  setPlacements,
  signSizeRatio,
  setSignSizeRatio,
}: {
  pages: PageRender[];
  activePage: number;
  setActivePage: (n: number) => void;
  signaturePng: string | null;
  setSignaturePng: (v: string | null) => void;
  placements: SignaturePlacement[];
  setPlacements: (v: SignaturePlacement[]) => void;
  signSizeRatio: number;
  setSignSizeRatio: (n: number) => void;
}) {
  const current = pages.find((p) => p.pageNumber === activePage);
  const placement = placements.find((p) => p.pageNumber === activePage);

  // サイン描画
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const strokesRef = useRef<ImageData[]>([]);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState(4);

  const getPos = (
    e: ReactPointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } | null => {
    const c = sigCanvasRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width;
    const sy = c.height / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  const pushSnapshot = useCallback(() => {
    const c = sigCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    strokesRef.current.push(ctx.getImageData(0, 0, c.width, c.height));
    if (strokesRef.current.length > 20) strokesRef.current.shift();
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = getPos(e);
    if (!p) return;
    pushSnapshot();
    drawingRef.current = true;
    lastPointRef.current = p;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const c = sigCanvasRef.current;
    const ctx = c?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = penColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, penWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const p = getPos(e);
    if (!p) return;
    const c = sigCanvasRef.current;
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
  const clearSig = () => {
    const c = sigCanvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    pushSnapshot();
    ctx.clearRect(0, 0, c.width, c.height);
  };
  const undoSig = () => {
    const c = sigCanvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const snap = strokesRef.current.pop();
    if (!snap) return;
    ctx.putImageData(snap, 0, 0);
  };
  const confirmSig = () => {
    const c = sigCanvasRef.current;
    if (!c) return;
    const png = c.toDataURL("image/png");
    setSignaturePng(png);
  };

  // ページプレビュー上での配置クリック
  const previewRef = useRef<HTMLDivElement | null>(null);
  const placeOnPage = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!signaturePng || !current) return;
    const box = previewRef.current?.getBoundingClientRect();
    if (!box) return;
    const xRatio = (e.clientX - box.left) / box.width;
    const yRatio = (e.clientY - box.top) / box.height;
    const newPlacements = placements.filter(
      (p) => p.pageNumber !== current.pageNumber,
    );
    newPlacements.push({
      pageNumber: current.pageNumber,
      xRatio: Math.max(0, Math.min(1, xRatio - signSizeRatio / 2)),
      yRatio: Math.max(0, Math.min(1, yRatio - signSizeRatio / 4)),
      widthRatio: signSizeRatio,
      imagePng: signaturePng,
    });
    setPlacements(newPlacements);
  };
  const removePlacement = (pageNumber: number) => {
    setPlacements(placements.filter((p) => p.pageNumber !== pageNumber));
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-base font-semibold text-gray-700">
          Step 2: サインを描いて、ページに配置する
        </h2>
        <p className="text-xs text-gray-500">
          下のページサムネから「サインを入れるページ」を選び、サインを描いてから
          プレビュー上の置きたい位置をタップ/クリックしてください。
        </p>

        {/* ページサムネ */}
        <div className="overflow-x-auto">
          <div className="flex gap-2">
            {pages.map((p) => {
              const has = placements.some((pl) => pl.pageNumber === p.pageNumber);
              const active = activePage === p.pageNumber;
              return (
                <button
                  key={p.pageNumber}
                  type="button"
                  onClick={() => setActivePage(p.pageNumber)}
                  className={
                    "relative flex w-20 shrink-0 flex-col items-center gap-1 rounded-lg border-2 p-1 text-[10px] " +
                    (active
                      ? "border-brand-600 bg-brand-50"
                      : "border-gray-200 hover:border-brand-400")
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.dataUrl}
                    alt={`p${p.pageNumber}`}
                    className="aspect-[3/4] w-full rounded object-contain"
                  />
                  <span>P.{p.pageNumber}</span>
                  {has && (
                    <span className="absolute right-0 top-0 rounded-full bg-pink-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* サイン描画ボード */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">
          サインを描く
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
          <label className="flex items-center gap-2 text-xs text-gray-600">
            配置サイズ
            <input
              type="range"
              min={10}
              max={70}
              value={Math.round(signSizeRatio * 100)}
              onChange={(e) => setSignSizeRatio(Number(e.target.value) / 100)}
              className="accent-pink-600"
            />
            <span>{Math.round(signSizeRatio * 100)}%</span>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={undoSig}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              元に戻す
            </button>
            <button
              type="button"
              onClick={clearSig}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              全消去
            </button>
            <button
              type="button"
              onClick={confirmSig}
              className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
            >
              サインを確定
            </button>
          </div>
        </div>
        <div
          className="rounded-xl border border-gray-300 bg-white"
          style={{ touchAction: "none" }}
        >
          <canvas
            ref={sigCanvasRef}
            width={1200}
            height={400}
            className="block h-auto w-full rounded-xl"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
        </div>
        {signaturePng && (
          <p className="text-xs text-emerald-700">
            ✓ サインが確定しました。下のページプレビューで置きたい場所をタップ/クリックすると配置されます。
          </p>
        )}
      </div>

      {/* ページプレビュー（配置先） */}
      {current && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              ページ {current.pageNumber} に配置
            </p>
            {placement && (
              <button
                type="button"
                onClick={() => removePlacement(current.pageNumber)}
                className="text-xs text-red-600 hover:underline"
              >
                このページの配置を消す
              </button>
            )}
          </div>
          <div
            ref={previewRef}
            onClick={placeOnPage}
            className="relative mx-auto max-w-md cursor-crosshair overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.dataUrl}
              alt={`page ${current.pageNumber}`}
              className="block h-auto w-full select-none"
              draggable={false}
            />
            {placement && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={placement.imagePng}
                alt="signature"
                draggable={false}
                className="pointer-events-none absolute select-none"
                style={{
                  left: `${placement.xRatio * 100}%`,
                  top: `${placement.yRatio * 100}%`,
                  width: `${placement.widthRatio * 100}%`,
                  height: "auto",
                }}
              />
            )}
          </div>
          <p className="text-[11px] text-gray-400">
            ※ クリック/タップした位置を中心にサインが配置されます。
            位置を変えたい場合はもう一度クリック/タップしてください。
          </p>
        </div>
      )}
    </section>
  );
}

/* ----------------------- Step 3 電子書籍ビューワ ----------------------- */

function Step3Viewer({
  pages,
  placements,
  viewerMode,
  setViewerMode,
  viewerPage,
  setViewerPage,
  zoom,
  setZoom,
}: {
  pages: PageRender[];
  placements: SignaturePlacement[];
  viewerMode: "spread" | "vertical";
  setViewerMode: (v: "spread" | "vertical") => void;
  viewerPage: number;
  setViewerPage: (n: number) => void;
  zoom: number;
  setZoom: (n: number) => void;
}) {
  const placementMap = useMemo(() => {
    const m = new Map<number, SignaturePlacement>();
    placements.forEach((p) => m.set(p.pageNumber, p));
    return m;
  }, [placements]);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // キーボード操作（見開きモード）
  useEffect(() => {
    if (viewerMode !== "spread") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setViewerPage(Math.min(pages.length, viewerPage + 2));
      } else if (e.key === "ArrowLeft") {
        setViewerPage(Math.max(1, viewerPage - 2));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerMode, viewerPage, pages.length, setViewerPage]);

  // 縦スクロール時、viewerPage に応じてスクロール
  useEffect(() => {
    if (viewerMode !== "vertical") return;
    const el = containerRef.current?.querySelector(
      `[data-page="${viewerPage}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [viewerMode, viewerPage]);

  const goPrev = () => {
    if (viewerMode === "spread") {
      setViewerPage(Math.max(1, viewerPage - 2));
    } else {
      setViewerPage(Math.max(1, viewerPage - 1));
    }
  };
  const goNext = () => {
    if (viewerMode === "spread") {
      setViewerPage(Math.min(pages.length, viewerPage + 2));
    } else {
      setViewerPage(Math.min(pages.length, viewerPage + 1));
    }
  };

  const renderPage = (page: PageRender, key: string) => {
    const pm = placementMap.get(page.pageNumber);
    return (
      <div
        key={key}
        data-page={page.pageNumber}
        className="relative shrink-0 overflow-hidden bg-white shadow-md"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={page.dataUrl}
          alt={`page ${page.pageNumber}`}
          className="block h-auto w-full select-none"
          draggable={false}
        />
        {pm && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pm.imagePng}
            alt="signature"
            draggable={false}
            className="pointer-events-none absolute select-none"
            style={{
              left: `${pm.xRatio * 100}%`,
              top: `${pm.yRatio * 100}%`,
              width: `${pm.widthRatio * 100}%`,
              height: "auto",
            }}
          />
        )}
        <p className="absolute bottom-1 right-2 rounded bg-black/40 px-2 py-0.5 text-[10px] text-white">
          P.{page.pageNumber}
        </p>
      </div>
    );
  };

  return (
    <section className="space-y-3">
      {/* ツールバー */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setViewerMode("spread")}
            className={
              "rounded-full px-3 py-1 text-xs font-medium " +
              (viewerMode === "spread"
                ? "bg-white shadow text-gray-900"
                : "text-gray-500")
            }
          >
            📖 見開き
          </button>
          <button
            type="button"
            onClick={() => setViewerMode("vertical")}
            className={
              "rounded-full px-3 py-1 text-xs font-medium " +
              (viewerMode === "vertical"
                ? "bg-white shadow text-gray-900"
                : "text-gray-500")
            }
          >
            📃 縦スクロール
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            ➖
          </button>
          <span className="text-xs text-gray-600">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            ➕
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          ページ {viewerPage} / {pages.length}
        </div>
      </div>

      {/* ビューワ本体 */}
      <div
        ref={containerRef}
        className={
          "rounded-2xl border border-gray-200 bg-gray-100 p-3 " +
          (viewerMode === "vertical" ? "max-h-[80vh] overflow-y-auto" : "")
        }
      >
        {viewerMode === "spread" ? (
          <div className="flex items-center justify-center gap-4 transition-transform">
            {(() => {
              // 見開き：偶数+奇数のペア。1ページ目だけ単独で表紙扱い。
              const elems: React.ReactNode[] = [];
              if (viewerPage === 1) {
                const p1 = pages.find((p) => p.pageNumber === 1);
                if (p1) {
                  elems.push(
                    <div
                      key="cover"
                      style={{
                        width: `${30 * zoom}vw`,
                        maxWidth: `${320 * zoom}px`,
                      }}
                    >
                      {renderPage(p1, "cover")}
                    </div>,
                  );
                }
              } else {
                const left = viewerPage;
                const right = viewerPage + 1;
                const pL = pages.find((p) => p.pageNumber === left);
                const pR = pages.find((p) => p.pageNumber === right);
                const w = `${28 * zoom}vw`;
                const maxW = `${300 * zoom}px`;
                if (pL)
                  elems.push(
                    <div key={`l-${left}`} style={{ width: w, maxWidth: maxW }}>
                      {renderPage(pL, `l-${left}`)}
                    </div>,
                  );
                if (pR)
                  elems.push(
                    <div
                      key={`r-${right}`}
                      style={{ width: w, maxWidth: maxW }}
                    >
                      {renderPage(pR, `r-${right}`)}
                    </div>,
                  );
              }
              return elems;
            })()}
          </div>
        ) : (
          <div className="mx-auto flex flex-col items-center gap-3">
            {pages.map((p) => (
              <div
                key={p.pageNumber}
                style={{
                  width: `${60 * zoom}vw`,
                  maxWidth: `${640 * zoom}px`,
                }}
              >
                {renderPage(p, `v-${p.pageNumber}`)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ナビゲーション（見開きモード） */}
      {viewerMode === "spread" && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={viewerPage <= 1}
            className="rounded-full bg-gray-900 px-5 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:opacity-30"
          >
            ← 前
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={viewerPage >= pages.length}
            className="rounded-full bg-gray-900 px-5 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:opacity-30"
          >
            次 →
          </button>
        </div>
      )}

      {/* サムネ一覧 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3">
        <p className="mb-2 text-xs text-gray-500">サムネ一覧（タップで移動）</p>
        <div className="flex gap-2 overflow-x-auto">
          {pages.map((p) => {
            const has = placementMap.has(p.pageNumber);
            const active =
              viewerPage === p.pageNumber ||
              (viewerMode === "spread" && p.pageNumber === viewerPage + 1);
            return (
              <button
                key={p.pageNumber}
                type="button"
                onClick={() => setViewerPage(p.pageNumber)}
                className={
                  "relative flex w-16 shrink-0 flex-col items-center gap-0.5 rounded border-2 p-0.5 text-[10px] " +
                  (active
                    ? "border-brand-600"
                    : "border-gray-200 hover:border-brand-400")
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.dataUrl}
                  alt={`p${p.pageNumber}`}
                  className="aspect-[3/4] w-full rounded object-contain"
                />
                <span>P.{p.pageNumber}</span>
                {has && (
                  <span className="absolute right-0 top-0 rounded-full bg-pink-600 px-1 text-[9px] font-bold text-white">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
