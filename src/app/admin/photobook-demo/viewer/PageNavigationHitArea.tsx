"use client";

/**
 * ページ送り用の透明クリック領域。
 * 写真の左右1/3を判定領域にして、中央はタップで UI 表示切替に使えるよう
 * 親側で処理する。スマホでは矢印アイコンを薄く表示。
 */
export function PageNavigationHitArea({
  onPrev,
  onNext,
  visible,
}: {
  onPrev: () => void;
  onNext: () => void;
  visible: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onPrev}
        aria-label="前のページ"
        className="group absolute inset-y-0 left-0 z-10 flex w-1/4 items-center justify-start pl-4 focus:outline-none"
      >
        <span
          className={
            "inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/30 text-2xl text-white backdrop-blur transition-opacity " +
            (visible ? "opacity-60 group-hover:opacity-100" : "opacity-0")
          }
        >
          ‹
        </span>
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="次のページ"
        className="group absolute inset-y-0 right-0 z-10 flex w-1/4 items-center justify-end pr-4 focus:outline-none"
      >
        <span
          className={
            "inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/30 text-2xl text-white backdrop-blur transition-opacity " +
            (visible ? "opacity-60 group-hover:opacity-100" : "opacity-0")
          }
        >
          ›
        </span>
      </button>
    </>
  );
}
