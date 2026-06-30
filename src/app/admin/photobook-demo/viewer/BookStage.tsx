"use client";

import dynamic from "next/dynamic";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
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
 * BookStage：本の見開きを表示するステージ。
 *
 * - 親要素のサイズを ResizeObserver で実測し、HTMLFlipBook に width/height を渡す
 * - showCover=true で 1ページ目を表紙（単独）扱い
 * - usePortrait で 768px 未満は自動的に1ページ縦書き表示に切替
 * - めくり影・ページの裏面表現は react-pageflip が描画
 */
export const BookStage = forwardRef<
  BookStageHandle,
  {
    pages: ViewerPage[];
    signatures: Map<number, ViewerSignature>;
    watermark?: string | null;
    /** 現在のページ番号（1始まり、見開きなら左ページ） */
    currentPage: number;
    /** ページめくり完了時のコールバック（react-pageflip の onFlip） */
    onFlipped: (newPageIndex: number) => void;
  }
>(function BookStage(
  { pages, signatures, watermark, currentPage, onFlipped },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const flipBookRef = useRef<FlipBookApi | null>(null);

  // ページ縦横比を1ページ目で算出
  const refPage = pages[0];
  const pageRatio = refPage ? refPage.width / refPage.height : 0.7;

  // 親領域に合わせて 1ページのピクセルサイズを計算
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      // 余白として 6% を確保
      const availW = r.width * 0.94;
      const availH = r.height * 0.94;
      // 見開きを想定。1ページの幅と高さを決める
      // ステージ全体: 2ページ並んだ aspect (pageRatio * 2)
      const spreadAspect = pageRatio * 2;
      let stageW: number;
      let stageH: number;
      if (availW / availH > spreadAspect) {
        // 高さ基準でフィット
        stageH = availH;
        stageW = stageH * spreadAspect;
      } else {
        stageW = availW;
        stageH = stageW / spreadAspect;
      }
      // 1ページサイズ
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
      turnTo: (idx: number) => flipBookRef.current?.pageFlip().turnToPage(idx),
    }),
    [],
  );

  // 外から currentPage が変わった場合（サムネからのジャンプ等）、ライブラリ側にも反映
  useEffect(() => {
    const api = flipBookRef.current?.pageFlip();
    if (!api) return;
    // pageFlip の page index は 0 始まり、showCover=true の場合は表紙が index 0
    const targetIndex = Math.max(0, currentPage - 1);
    const cur = api.getCurrentPageIndex();
    if (cur !== targetIndex) {
      api.turnToPage(targetIndex);
    }
  }, [currentPage]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden"
    >
      {size.w > 0 && size.h > 0 && (
        // HTMLFlipBook は React.MemoExoticComponent<ForwardRef> で、
        // 型定義が厳密に必須props を強制してくる。実際は省略可能だが
        // 型解決のためにすべて指定する。
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
          showCover
          mobileScrollSupport
          clickEventForward
          useMouseEvents
          swipeDistance={30}
          showPageCorners
          disableFlipByClick={false}
          startPage={Math.max(0, currentPage - 1)}
          className=""
          style={{}}
          onFlip={(e: { data: number }) => onFlipped(e.data + 1)}
        >
          {pages.map((p) => (
            <PageWrapper
              key={p.pageNumber}
              page={p}
              signature={signatures.get(p.pageNumber) ?? null}
              watermark={watermark}
            />
          ))}
        </HTMLFlipBook>
      )}
    </div>
  );
});

/**
 * react-pageflip は子要素を「ページ」として直接扱うので、ref forward + クラス必須。
 */
const PageWrapper = forwardRef<
  HTMLDivElement,
  {
    page: ViewerPage;
    signature: ViewerSignature | null;
    watermark?: string | null;
  }
>(function PageWrapper({ page, signature, watermark }, ref) {
  return (
    <div
      ref={ref}
      className="bg-zinc-950 [--page-shadow:0_2px_8px_rgba(0,0,0,0.4)]"
    >
      <PageImage page={page} signature={signature} watermark={watermark} />
    </div>
  );
});
