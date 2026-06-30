"use client";

/**
 * 上部バー。
 * - 戻るボタン、タイトル
 * - 操作が一定時間ないと薄れて消える
 */
export function ViewerHeader({
  title,
  visible,
  onClose,
}: {
  title?: string;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={
        "pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-4 pt-3 transition-opacity duration-200 " +
        (visible ? "opacity-100" : "opacity-0")
      }
      style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
    >
      <button
        type="button"
        onClick={onClose}
        className={
          "pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 " +
          (visible ? "" : "pointer-events-none")
        }
        aria-label="閉じる"
      >
        ✕
      </button>
      {title && (
        <p className="pointer-events-none truncate text-sm text-white/70">
          {title}
        </p>
      )}
    </div>
  );
}
