"use client";

import dynamic from "next/dynamic";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { PageImage } from "./PageImage";
import type { ViewerPage, ViewerSignature } from "./types";

/**
 * react-pageflip は SSR で動かないので dynamic import で no-ssr 化。
 */
const HTMLFlipBook = dynamic(
  () => import("react-pageflip").then((mod) => mod.default),
  { ssr: false },
);

// react-pageflip インスタンスのメソッド型（必要分だけ）
type FlipBookApi = {
  pageFlip: () => {
    flipNext: () => void;
    flipPrev: () => void;
    turnToPage: (n: number) => void;
    getCurrentPageIndex: () => number;
    getPageCount: () => number;
  };
};

export type BookStageHandle = {
  flipNext: () => void;
  flipPrev: () => void;
  turnTo: (pageIndex: number) => void;
};

/**
 * 内部ページ表現:
 *   - kind: "page" → 実ページ（dataUrl + サイン）
 *   - kind: "blank" → 白紙ページ（写真集の見開きを揃えるため）
 *
 * 写真集の標準的なページ並び:
 *   1: 表紙（単独）
 *   2: 白紙（自動挿入）
 *   3: 本文P1（=元PDFのP2）
 *   4: 本文P2（=元PDFのP3）
 *   ...
 *
 * react-pageflip の onFlip が返すのは「めくった結果の左ページのインデックス」。
 * 元PDFのページ番号に戻したいときは、白紙分を引いて求める。
 */
type InternalPage =
  | { kind: "page"; page: ViewerPage }
  | { kind: "blank" };

/**
 * 内部ページ列を構築する。
 *
 *  spreadLayout=true（PC/タブレット, 見開き）:
 *    [白紙 | 表紙] [P2 | P3] [P4 | P5] ... (末尾が奇数なら [Pn | 白紙])
 *    showCover=false で先頭から見開き表示。先頭白紙は背景に溶け込ませることで
 *    「表紙が中央に1枚あるように見える」体験を作る。
 *    めくると [P2 | P3] [P4 | P5] と本文だけの見開きが続く。
 *
 *  spreadLayout=false（スマホ縦持ち, 1ページモード）:
 *    元PDF をそのまま順番に表示。白紙なし。
 */
function buildInternalPages(
  pages: ViewerPage[],
  spreadLayout: boolean,
): InternalPage[] {
  if (pages.length === 0) return [];
  if (!spreadLayout) {
    return pages.map((page) => ({ kind: "page", page }));
  }
  const out: InternalPage[] = [];
  out.push({ kind: "blank" }); // 表紙の左に置く白紙
  for (const page of pages) {
    out.push({ kind: "page", page });
  }
  // 末尾を必ず偶数枚にする（最後が見開きで完結するように）
  if (out.length % 2 === 1) {
    out.push({ kind: "blank" });
  }
  return out;
}

/** 元PDFのページ番号 → 内部インデックス */
function originalToInternalIndex(
  pageNumber: number,
  spreadLayout: boolean,
): number {
  if (!spreadLayout) return Math.max(0, pageNumber - 1);
  // 先頭に白紙が1枚ある: PDFのP1 = 内部 index 1
  return Math.max(0, pageNumber);
}

/** 内部インデックス → 元PDFのページ番号 */
function internalToOriginalPageNumber(
  internalIndex: number,
  spreadLayout: boolean,
): number {
  if (!spreadLayout) return Math.max(1, internalIndex + 1);
  if (internalIndex <= 0) return 1; // 先頭白紙 → 表紙扱い
  return internalIndex; // P1 = index 1, P2 = index 2 ...
}

/**
 * BookStage：本の見開きを表示するステージ。
 *
 * - 親要素のサイズを ResizeObserver で実測し、HTMLFlipBook に width/height を渡す
 * - showCover=true で表紙を単独扱い、表紙の裏に白紙を入れて見開きを揃える
 * - usePortrait で 768px 未満は自動的に1ページ縦長表示に切替
 * - zoom (0.6〜2.5) は transform: scale で適用、ピンチ対応
 */
export const BookStage = forwardRef<
  BookStageHandle,
  {
    pages: ViewerPage[];
    signatures: Map<number, ViewerSignature>;
    watermark?: string | null;
    /** 現在のページ番号（元PDFのページ番号、1始まり） */
    currentPage: number;
    /** ページめくり完了時のコールバック（元PDFのページ番号） */
    onFlipped: (newPageNumber: number) => void;
    /** ズーム倍率（外部から制御） */
    zoom: number;
    /** ピンチ時に外部に通知して同期 */
    onZoomChange: (z: number) => void;
  }
>(function BookStage(
  { pages, signatures, watermark, currentPage, onFlipped, zoom, onZoomChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const flipBookRef = useRef<FlipBookApi | null>(null);

  // 画面幅でレイアウトを切り替える。
  //   >= 768px: 見開きモード（白紙挿入で「表紙→見開き」）
  //   < 768px:  1ページモード（白紙なし、元PDFそのまま）
  const [insertCoverBack, setInsertCoverBack] = useState(false);
  useEffect(() => {
    const detect = () => setInsertCoverBack(window.innerWidth >= 768);
    detect();
    window.addEventListener("resize", detect);
    return () => window.removeEventListener("resize", detect);
  }, []);

  const internalPages = useMemo(
    () => buildInternalPages(pages, insertCoverBack),
    [pages, insertCoverBack],
  );

  // ページ縦横比を1ページ目で算出
  const refPage = pages[0];
  const pageRatio = refPage ? refPage.width / refPage.height : 0.7;

  // 親領域に合わせて 1ページのピクセルサイズを計算
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      const availW = r.width * 0.94;
      const availH = r.height * 0.94;
      const spreadAspect = pageRatio * 2;
      let stageW: number;
      let stageH: number;
      if (availW / availH > spreadAspect) {
        stageH = availH;
        stageW = stageH * spreadAspect;
      } else {
        stageW = availW;
        stageH = stageW / spreadAspect;
      }
      const w = Math.floor(stageW / 2);
      const h = Math.floor(stageH);
      setSize({ w, h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageRatio]);

  // 外部からめくり操作を呼べるようにする
  useImperativeHandle(
    ref,
    () => ({
      flipNext: () => flipBookRef.current?.pageFlip().flipNext(),
      flipPrev: () => flipBookRef.current?.pageFlip().flipPrev(),
      turnTo: (originalPageNumber: number) => {
        const idx = originalToInternalIndex(
          originalPageNumber,
          insertCoverBack,
        );
        flipBookRef.current?.pageFlip().turnToPage(idx);
      },
    }),
    [insertCoverBack],
  );

  // 外から currentPage が変わった場合（サムネからのジャンプ等）、ライブラリ側にも反映
  useEffect(() => {
    const api = flipBookRef.current?.pageFlip();
    if (!api) return;
    const targetIndex = originalToInternalIndex(currentPage, insertCoverBack);
    const cur = api.getCurrentPageIndex();
    if (cur !== targetIndex) {
      api.turnToPage(targetIndex);
    }
  }, [currentPage, insertCoverBack]);

  /* ----------------- ピンチズーム ----------------- */
  // 2本指の距離を測ってズーム倍率に反映。clamp 0.6〜2.5
  const pinchStartRef = useRef<{
    distance: number;
    zoom: number;
  } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartRef.current = {
        distance: Math.sqrt(dx * dx + dy * dy),
        zoom,
      };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / pinchStartRef.current.distance;
      const next = Math.min(
        2.5,
        Math.max(0.6, pinchStartRef.current.zoom * ratio),
      );
      onZoomChange(+next.toFixed(2));
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchStartRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {size.w > 0 && size.h > 0 && (
        <div
          className="transition-transform duration-200"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <HTMLFlipBook
            ref={(inst) => {
              flipBookRef.current = inst as unknown as FlipBookApi | null;
            }}
            width={size.w}
            height={size.h}
            size="fixed"
            minWidth={150}
            maxWidth={2000}
            minHeight={200}
            maxHeight={3000}
            drawShadow
            flippingTime={550}
            usePortrait
            startZIndex={0}
            autoSize={false}
            maxShadowOpacity={0.5}
            showCover={false}
            mobileScrollSupport
            clickEventForward
            useMouseEvents
            swipeDistance={30}
            showPageCorners
            disableFlipByClick={false}
            startPage={originalToInternalIndex(currentPage, insertCoverBack)}
            className=""
            style={{}}
            onFlip={(e: { data: number }) =>
              onFlipped(internalToOriginalPageNumber(e.data, insertCoverBack))
            }
          >
            {internalPages.map((ip, idx) => {
              if (ip.kind === "blank") {
                return (
                  <PageWrapper
                    key={`blank-${idx}`}
                    page={null}
                    signature={null}
                    watermark={watermark}
                  />
                );
              }
              return (
                <PageWrapper
                  key={`page-${ip.page.pageNumber}`}
                  page={ip.page}
                  signature={signatures.get(ip.page.pageNumber) ?? null}
                  watermark={watermark}
                />
              );
            })}
          </HTMLFlipBook>
        </div>
      )}
    </div>
  );
});

/**
 * react-pageflip は子要素を「ページ」として直接扱うので、ref forward + クラス必須。
 * page=null は白紙ページ。
 */
const PageWrapper = forwardRef<
  HTMLDivElement,
  {
    page: ViewerPage | null;
    signature: ViewerSignature | null;
    watermark?: string | null;
  }
>(function PageWrapper({ page, signature, watermark }, ref) {
  return (
    <div ref={ref} className="bg-zinc-950">
      <PageImage page={page} signature={signature} watermark={watermark} />
    </div>
  );
});
