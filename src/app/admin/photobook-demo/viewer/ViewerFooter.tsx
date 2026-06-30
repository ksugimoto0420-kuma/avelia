"use client";

/**
 * 下部バー。
 * - ページ番号（常に控えめに表示）
 * - サムネ一覧ボタン
 * - 操作がないと薄れて消える
 *
 * 見開き切替・拡大縮小は react-pageflip が usePortrait で自動切替するため、
 * ボタンとしては露出させない。
 */
export function ViewerFooter({
  currentLabel,
  totalPages,
  visible,
  onOpenThumbs,
}: {
  currentLabel: string;
  totalPages: number;
  visible: boolean;
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
      </div>
    </div>
  );
}
