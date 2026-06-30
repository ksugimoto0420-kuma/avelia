"use client";

import { useEffect, useRef } from "react";
import type { ViewerPage, ViewerSignature } from "./types";

/**
 * サムネイル一覧モーダル。
 * - 下部から立ち上がるシート風
 * - 現在ページをハイライト
 * - サイン入りページにバッジ
 * - タップで該当ページへ移動
 */
export function ThumbnailStrip({
  open,
  pages,
  signatures,
  currentPage,
  onClose,
  onJump,
}: {
  open: boolean;
  pages: ViewerPage[];
  signatures: Map<number, ViewerSignature>;
  currentPage: number;
  onClose: () => void;
  onJump: (pageNumber: number) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // 開いたとき、現在ページが見える位置にスクロール
  useEffect(() => {
    if (open && activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [open, currentPage]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-t-2xl border-t border-white/10 bg-zinc-950/95 p-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs tracking-wider text-white/70">
            ページ一覧 ({pages.length} ページ)
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {pages.map((p) => {
            const isActive = p.pageNumber === currentPage;
            const hasSig = signatures.has(p.pageNumber);
            return (
              <button
                key={p.pageNumber}
                ref={isActive ? activeRef : null}
                type="button"
                onClick={() => {
                  onJump(p.pageNumber);
                  onClose();
                }}
                className={
                  "relative w-20 shrink-0 overflow-hidden rounded border-2 transition " +
                  (isActive
                    ? "border-white shadow-[0_0_0_2px_rgba(255,255,255,0.2)]"
                    : "border-transparent hover:border-white/40")
                }
                aria-label={`ページ ${p.pageNumber} へ`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.dataUrl}
                  alt=""
                  draggable={false}
                  className="block aspect-[3/4] w-full select-none object-contain bg-zinc-900"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 pb-0.5 pt-2 text-center text-[10px] text-white/90">
                  {p.pageNumber}
                </span>
                {hasSig && (
                  <span className="absolute right-0.5 top-0.5 rounded bg-white/85 px-1 text-[8px] font-bold tracking-wider text-zinc-900">
                    Signed
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
