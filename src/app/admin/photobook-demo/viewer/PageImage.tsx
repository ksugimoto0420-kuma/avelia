"use client";

import type { ViewerPage, ViewerSignature } from "./types";

/**
 * 1ページを描画するコンポーネント。
 * - 写真は object-contain で縦横比を維持
 * - サインがあれば右下寄りなど指定位置に重ねる
 * - 購入者透かしを薄く全面に重ねる（コピー対策）
 * - 右クリック・ドラッグ保存・選択を抑制
 * - page が null の場合は「白紙ページ」として描画する
 */
export function PageImage({
  page,
  signature,
  watermark,
  isFirstFrame,
}: {
  page: ViewerPage | null;
  signature: ViewerSignature | null;
  watermark?: string | null;
  /** 初回読込時のフェード演出に使う */
  isFirstFrame?: boolean;
}) {
  // 白紙ページ：写真集の見開きを成立させるための裏面・先頭/末尾の余りページ。
  // ビューワー背景（#000）に溶け込ませて、隣接する実ページが
  // 中央に大きく見えるようにする。
  if (!page) {
    return (
      <div
        className="relative h-full w-full overflow-hidden bg-black"
        onContextMenu={(e) => e.preventDefault()}
      />
    );
  }

  return (
    <div
      className={
        "relative h-full w-full overflow-hidden bg-zinc-950 " +
        (isFirstFrame ? "animate-[fadeIn_400ms_ease-out_forwards]" : "")
      }
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={page.dataUrl}
        alt={`page ${page.pageNumber}`}
        className="block h-full w-full select-none object-contain [-webkit-touch-callout:none] [-webkit-user-select:none]"
        draggable={false}
      />

      {/* サインオーバーレイ */}
      {signature && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={signature.imagePng}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={{
            left: `${signature.xRatio * 100}%`,
            top: `${signature.yRatio * 100}%`,
            width: `${signature.widthRatio * 100}%`,
            height: "auto",
          }}
        />
      )}

      {/* Signedバッジ（控えめ、右上） */}
      {signature && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium tracking-wider text-white/90 backdrop-blur">
          Signed
        </div>
      )}

      {/* 透かし（コピー対策、薄く繰り返し） */}
      {watermark && (
        <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-6 opacity-[0.06]">
            {Array.from({ length: 18 }, (_, i) => (
              <div
                key={i}
                className="flex items-center justify-center text-[11px] text-white"
              >
                {watermark}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
