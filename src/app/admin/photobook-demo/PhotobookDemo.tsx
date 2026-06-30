"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { PhotobookViewer } from "./viewer/PhotobookViewer";
import type { ViewerSignature } from "./viewer/types";

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
  // 一括配置する対象ページ（チェックボックスで複数選択）
  const [selectedPages, setSelectedPages] = useState<Set<number>>(
    () => new Set<number>(),
  );
  const [signaturePng, setSignaturePng] = useState<string | null>(null);
  const [placements, setPlacements] = useState<SignaturePlacement[]>([]);
  // 配置中のサイズ
  const [signSizeRatio, setSignSizeRatio] = useState(0.3);
  // デフォルト配置位置（一括配置や初回クリック時の中心位置）
  const [defaultXRatio, setDefaultXRatio] = useState(0.5);
  const [defaultYRatio, setDefaultYRatio] = useState(0.85);

  // 4. ビューワ
  const [fullscreen, setFullscreen] = useState(false);

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
    setSelectedPages(new Set());
    setActivePage(1);
    setError(null);
    setFullscreen(false);
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
          selectedPages={selectedPages}
          setSelectedPages={setSelectedPages}
          signaturePng={signaturePng}
          setSignaturePng={setSignaturePng}
          placements={placements}
          setPlacements={setPlacements}
          signSizeRatio={signSizeRatio}
          setSignSizeRatio={setSignSizeRatio}
          defaultXRatio={defaultXRatio}
          setDefaultXRatio={setDefaultXRatio}
          defaultYRatio={defaultYRatio}
          setDefaultYRatio={setDefaultYRatio}
        />
      )}
      {step === 3 && pages.length > 0 && (
        <Step3Viewer
          pages={pages}
          placements={placements}
          fullscreen={fullscreen}
          setFullscreen={setFullscreen}
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
  selectedPages,
  setSelectedPages,
  signaturePng,
  setSignaturePng,
  placements,
  setPlacements,
  signSizeRatio,
  setSignSizeRatio,
  defaultXRatio,
  setDefaultXRatio,
  defaultYRatio,
  setDefaultYRatio,
}: {
  pages: PageRender[];
  activePage: number;
  setActivePage: (n: number) => void;
  selectedPages: Set<number>;
  setSelectedPages: (v: Set<number>) => void;
  signaturePng: string | null;
  setSignaturePng: (v: string | null) => void;
  placements: SignaturePlacement[];
  setPlacements: (v: SignaturePlacement[]) => void;
  signSizeRatio: number;
  setSignSizeRatio: (n: number) => void;
  defaultXRatio: number;
  setDefaultXRatio: (n: number) => void;
  defaultYRatio: number;
  setDefaultYRatio: (n: number) => void;
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

  // ページプレビュー上での配置クリック（個別ページ調整用）
  const previewRef = useRef<HTMLDivElement | null>(null);
  const placeOnPage = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!signaturePng || !current) return;
    const box = previewRef.current?.getBoundingClientRect();
    if (!box) return;
    const xRatio = (e.clientX - box.left) / box.width;
    const yRatio = (e.clientY - box.top) / box.height;
    // クリック位置を中心に配置（中央寄せ調整）
    const adjX = Math.max(0, Math.min(1, xRatio - signSizeRatio / 2));
    const adjY = Math.max(0, Math.min(1, yRatio - signSizeRatio / 4));
    const newPlacements = placements.filter(
      (p) => p.pageNumber !== current.pageNumber,
    );
    newPlacements.push({
      pageNumber: current.pageNumber,
      xRatio: adjX,
      yRatio: adjY,
      widthRatio: signSizeRatio,
      imagePng: signaturePng,
    });
    setPlacements(newPlacements);
    // 次回の一括配置用のデフォルト位置も更新
    setDefaultXRatio(xRatio);
    setDefaultYRatio(yRatio);
  };
  const removePlacement = (pageNumber: number) => {
    setPlacements(placements.filter((p) => p.pageNumber !== pageNumber));
  };

  // 選択ページに一括でサインを配置
  const applyToSelected = () => {
    if (!signaturePng) return;
    if (selectedPages.size === 0) return;
    const adjX = Math.max(0, Math.min(1, defaultXRatio - signSizeRatio / 2));
    const adjY = Math.max(0, Math.min(1, defaultYRatio - signSizeRatio / 4));
    const newPlacements = placements.filter(
      (p) => !selectedPages.has(p.pageNumber),
    );
    for (const pageNumber of Array.from(selectedPages).sort((a, b) => a - b)) {
      newPlacements.push({
        pageNumber,
        xRatio: adjX,
        yRatio: adjY,
        widthRatio: signSizeRatio,
        imagePng: signaturePng,
      });
    }
    setPlacements(newPlacements);
  };

  const removeSelected = () => {
    if (selectedPages.size === 0) return;
    setPlacements(
      placements.filter((p) => !selectedPages.has(p.pageNumber)),
    );
  };

  const togglePage = (pageNumber: number) => {
    const next = new Set(selectedPages);
    if (next.has(pageNumber)) next.delete(pageNumber);
    else next.add(pageNumber);
    setSelectedPages(next);
  };
  const selectAll = () => {
    setSelectedPages(new Set(pages.map((p) => p.pageNumber)));
  };
  const clearSelection = () => {
    setSelectedPages(new Set());
  };

  return (
    <section className="space-y-4">
      {/* 進捗サマリ */}
      <div className="rounded-lg bg-gray-50 p-2 text-xs">
        <span className="font-semibold text-gray-700">
          サイン: {signaturePng ? "✓ 描画済み" : "未描画"} ／ 選択中:{" "}
          {selectedPages.size} ページ ／ 配置済み: {placements.length} ページ
        </span>
      </div>

      {/* ① サインを描く */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-base font-semibold text-gray-700">
          ① サインを描く
        </h2>
        <p className="text-xs text-gray-500">
          まずはここでサインを描いてください。色・太さを選んで、書き終わったら
          「サインを確定」を押します。
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
              className="rounded-md bg-brand-600 px-3 py-1 text-xs font-bold text-white hover:bg-brand-700"
            >
              ✓ サインを確定
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
            ✓ サインが確定しました。次のステップでページを選んでください。
          </p>
        )}
      </div>

      {/* ② サインを入れたいページを選ぶ */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-base font-semibold text-gray-700">
          ② サインを入れたいページを選ぶ
        </h2>
        <p className="text-xs text-gray-500">
          サムネのチェックボックスをタップして、サインを入れたいページを選びます。
          複数選択できます。
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={selectAll}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50"
          >
            全選択
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50"
          >
            選択解除
          </button>
          <span className="ml-auto font-semibold text-pink-600">
            {selectedPages.size} ページ選択中
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-2">
            {pages.map((p) => {
              const has = placements.some(
                (pl) => pl.pageNumber === p.pageNumber,
              );
              const isSelected = selectedPages.has(p.pageNumber);
              const isActive = activePage === p.pageNumber;
              return (
                <div
                  key={p.pageNumber}
                  className={
                    "relative w-24 shrink-0 rounded-lg border-2 p-1 text-[10px] transition " +
                    (isActive
                      ? "border-brand-600 bg-brand-50"
                      : isSelected
                        ? "border-pink-500 bg-pink-50"
                        : "border-gray-200 bg-white")
                  }
                >
                  <label className="absolute left-1 top-1 z-10 flex cursor-pointer items-center justify-center rounded bg-white/90 px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePage(p.pageNumber)}
                      className="h-3.5 w-3.5 accent-pink-600"
                      aria-label={`ページ ${p.pageNumber} を選択`}
                    />
                  </label>
                  {has && (
                    <span className="absolute right-1 top-1 z-10 rounded-full bg-pink-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      ✓
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setActivePage(p.pageNumber)}
                    className="block w-full text-center"
                    aria-label={`ページ ${p.pageNumber} を編集`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.dataUrl}
                      alt={`p${p.pageNumber}`}
                      className="aspect-[3/4] w-full rounded object-contain"
                    />
                    <span className="mt-1 block">P.{p.pageNumber}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ③ 選択ページにサインを配置 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-base font-semibold text-gray-700">
          ③ 選択ページにサインを配置
        </h2>
        <p className="text-xs text-gray-500">
          配置サイズを決めて「選択中のページに一括配置」を押すと、選んだ全ページに
          同じサインが入ります。位置を変えたい場合は ④ で個別調整できます。
        </p>
        <div className="flex flex-wrap items-center gap-3">
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
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={applyToSelected}
              disabled={!signaturePng || selectedPages.size === 0}
              className="rounded-md bg-pink-600 px-4 py-2 text-sm font-bold text-white hover:bg-pink-700 disabled:opacity-40"
            >
              ✍ 選択中の {selectedPages.size} ページに一括配置
            </button>
            <button
              type="button"
              onClick={removeSelected}
              disabled={selectedPages.size === 0}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              選択中の配置を消す
            </button>
          </div>
        </div>
        {!signaturePng && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ① でサインを描いて「サインを確定」してから配置できます。
          </p>
        )}
        {signaturePng && selectedPages.size === 0 && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ② で配置するページを選んでください。
          </p>
        )}
      </div>

      {/* ④ 個別ページの位置を微調整（任意） */}
      {current && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-700">
              ④ 個別ページの位置を微調整（任意）
            </h2>
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
          <p className="text-xs text-gray-500">
            ②で選んだサムネをクリックすると、ここに該当ページが表示されます。
            ページ内のクリック位置を中心にサインが配置されます。
          </p>
          <p className="text-xs text-gray-600">
            <b>編集中のページ:</b> P.{current.pageNumber}
          </p>
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
            ※ ここで決めた位置は次回の「一括配置」のデフォルト位置にもなります。
          </p>
        </div>
      )}
    </section>
  );
}


/* ----------------------- Step 3 デジタル写真集ビューワ呼び出し ----------------------- */

function Step3Viewer({
  pages,
  placements,
  fullscreen,
  setFullscreen,
}: {
  pages: PageRender[];
  placements: SignaturePlacement[];
  fullscreen: boolean;
  setFullscreen: (v: boolean) => void;
}) {
  // viewer 形式に変換
  const sigList: ViewerSignature[] = placements.map((p) => ({
    pageNumber: p.pageNumber,
    xRatio: p.xRatio,
    yRatio: p.yRatio,
    widthRatio: p.widthRatio,
    imagePng: p.imagePng,
  }));

  // 全画面オープン時のスクロール抑制
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  return (
    <section className="space-y-3">
      <p className="text-xs text-gray-500">
        Step 3: 「ビューワを開く」でフルスクリーンの写真集ビューワを起動します。
        ESC で閉じる、矢印キー／クリック／スワイプでページめくり。
        画面中央タップでツールバー表示切替。
      </p>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-zinc-700"
        >
          📖 ビューワを開く
        </button>
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-40 bg-black">
          <PhotobookViewer
            pages={pages}
            signatures={sigList}
            title="サイン入り写真集（プレビュー）"
            watermark={null}
            onClose={() => setFullscreen(false)}
          />
        </div>
      )}
    </section>
  );
}
