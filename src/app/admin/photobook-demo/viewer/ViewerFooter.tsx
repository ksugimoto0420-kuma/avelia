"use client";

/**
 * 下部バー。
 * - ページ番号（常に控えめに表示）
 * - サムネ一覧ボタン、ズーム +/−
 * - 操作がないと薄れて消える
 *
 * 見開き切替は react-pageflip が usePortrait で自動切替するため、ボタンとしては露出させない。
 * スマホはピンチで、PC はここの +/− ボタンでズーム操作。
 */
export function ViewerFooter({
  currentLabel,
  totalPages,
  visible,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onOpenThumbs,
}: {
  currentLabel: string;
  totalPages: number;
  visible: boolean;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onOpenThumbs: () => void;
}) {
  return (
    <div
      className={
        "pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-4 pb-3 transition-opacity duration-200 " +
        (visible ? "opacity-100" : "opacity-0")
      }
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
    >
      {/* ページ番号は常に控えめに見えるよう、透過度は薄め */}
      <div className="pointer-events-none rounded-full bg-black/40 px-3 py-1 text-xs tracking-wider text-white/85 backdrop-blur">
        {currentLabel} <span className="text-white/40">/ {totalPages}</span>
      </div>

      <div
        className={
          "pointer-events-auto flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-white backdrop-blur " +
          (visible ? "" : "pointer-events-none")
        }
      >
        <button
          type="button"
          onClick={onOpenThumbs}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
          aria-label="サムネイル一覧"
          title="サムネイル一覧"
        >
          ☰
        </button>
        <div className="mx-1 h-4 w-px bg-white/15" />
        <button
          type="button"
          onClick={onZoomOut}
          disabled={zoom <= 0.6}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40"
          aria-label="縮小"
          title="縮小"
        >
          −
        </button>
        <button
          type="button"
          onClick={onZoomReset}
          className="min-w-12 rounded-full px-2 text-center text-[11px] text-white/70 hover:bg-white/10"
          aria-label="ズームをリセット"
          title="クリックで100%に戻す"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          disabled={zoom >= 2.5}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40"
          aria-label="拡大"
          title="拡大"
        >
          +
        </button>
      </div>
    </div>
  );
}
