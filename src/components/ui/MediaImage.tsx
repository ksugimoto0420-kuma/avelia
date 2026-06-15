import { cn } from "@/lib/utils";

/**
 * 任意アスペクト比の画像を「切れずに収めつつ、背景にぼかし複製を敷いて
 * 余白を埋める」ように表示する共通コンポーネント。
 * 元画像が外部URL指定でアスペクト比が揃わなくても見栄えを担保する。
 */
export function MediaImage({
  src,
  alt,
  aspect = "16/9",
  rounded = false,
  fallback,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  /** Tailwind の aspect-ratio 文字列（例 "16/9", "1/1", "4/3"） */
  aspect?: string;
  /** 角丸を別途付けたい時 */
  rounded?: boolean;
  /** src が null/空 の時に出すコンテンツ（例: イニシャル） */
  fallback?: React.ReactNode;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "relative w-full overflow-hidden bg-gradient-to-br from-brand-100 to-brand-50",
          rounded && "rounded-2xl",
          className,
        )}
        style={{ aspectRatio: aspect }}
      >
        <div className="flex h-full w-full items-center justify-center text-3xl font-black text-brand-300">
          {fallback ?? "—"}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-gray-900",
        rounded && "rounded-2xl",
        className,
      )}
      style={{ aspectRatio: aspect }}
    >
      {/* 背景：同じ画像を拡大＋ぼかしで敷く */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
      />
      <div className="absolute inset-0 bg-black/20" />
      {/* 前景：全体を収める */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="relative h-full w-full object-contain"
      />
    </div>
  );
}
