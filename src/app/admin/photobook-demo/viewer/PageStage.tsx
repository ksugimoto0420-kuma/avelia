"use client";

import { useEffect, useRef, useState } from "react";
import { PageImage } from "./PageImage";
import type { ViewerMode, ViewerPage, ViewerSignature } from "./types";

/**
 * ステージ：写真集ページを中央に配置する領域。
 *
 * - single: 1ページのみ表示
 * - spread: 表紙(1ページ目)は単独、それ以外は [n, n+1] の見開き
 *
 * 親領域に対して ResizeObserver でサイズを実測し、ページの縦横比を保ったまま
 * 最大化する。背景は黒、ページの周りに自然な余白を持つ。
 */
export function PageStage({
  pages,
  currentPage,
  mode,
  signatures,
  watermark,
  transition,
}: {
  pages: ViewerPage[];
  currentPage: number;
  mode: ViewerMode;
  signatures: Map<number, ViewerSignature>;
  watermark?: string | null;
  /** ページ遷移アニメ用に "next" | "prev" を一時的に渡せる */
  transition?: "none" | "next" | "prev";
}) {
  const refPage = pages[0];
  const pageRatio = refPage ? refPage.width / refPage.height : 0.7;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setAvailable({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 表示するページの組み合わせを決める
  const isCover = mode === "spread" && currentPage === 1;
  const isSingle = mode === "single";

  let leftPage: ViewerPage | null = null;
  let rightPage: ViewerPage | null = null;

  if (isSingle) {
    rightPage = pages.find((p) => p.pageNumber === currentPage) ?? null;
  } else if (isCover) {
    rightPage = pages.find((p) => p.pageNumber === 1) ?? null;
  } else {
    leftPage = pages.find((p) => p.pageNumber === currentPage) ?? null;
    rightPage = pages.find((p) => p.pageNumber === currentPage + 1) ?? null;
  }

  // ステージサイズ計算
  const spreadAspect = pageRatio * 2;
  const aspect = isCover || isSingle ? pageRatio : spreadAspect;

  // 余白マージン: 上下左右 5% ほど確保（高級感のための呼吸）
  const margin = 0.92;
  const availW = available.w * margin;
  const availH = available.h * margin;
  let stageW = availH * aspect;
  let stageH = availH;
  if (stageW > availW) {
    stageW = availW;
    stageH = availW / aspect;
  }

  // 遷移アニメ用クラス
  const transitionClass =
    transition === "next"
      ? "animate-[slideInFromRight_220ms_ease-out]"
      : transition === "prev"
        ? "animate-[slideInFromLeft_220ms_ease-out]"
        : "";

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden"
    >
      {available.w > 0 && available.h > 0 && (
        <div
          className={"relative " + transitionClass}
          style={{ width: `${stageW}px`, height: `${stageH}px` }}
        >
          {isCover || isSingle ? (
            <div className="absolute inset-0">
              {rightPage && (
                <PageImage
                  page={rightPage}
                  signature={signatures.get(rightPage.pageNumber) ?? null}
                  watermark={watermark}
                />
              )}
            </div>
          ) : (
            <div className="absolute inset-0 grid grid-cols-2">
              {/* 左ページ：右側に薄い影で見開きの溝を表現 */}
              <div className="relative">
                {leftPage && (
                  <PageImage
                    page={leftPage}
                    signature={signatures.get(leftPage.pageNumber) ?? null}
                    watermark={watermark}
                  />
                )}
                <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-r from-transparent to-black/30" />
              </div>
              <div className="relative">
                {rightPage && (
                  <PageImage
                    page={rightPage}
                    signature={signatures.get(rightPage.pageNumber) ?? null}
                    watermark={watermark}
                  />
                )}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-l from-transparent to-black/30" />
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideInFromRight {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInFromLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
