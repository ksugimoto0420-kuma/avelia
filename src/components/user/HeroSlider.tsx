"use client";

import { useEffect, useState } from "react";

type Props = {
  images: string[];
  /** 自動送りの間隔 (ms)。0 で自動送り無効。 */
  autoIntervalMs?: number;
};

/**
 * トップページのヒーロースライダー。
 * 1枚のときは静止、複数枚のときは自動送り + 前後ボタン + ドット表示。
 */
export function HeroSlider({ images, autoIntervalMs = 5000 }: Props) {
  const [index, setIndex] = useState(0);
  const total = images.length;

  useEffect(() => {
    if (total <= 1 || autoIntervalMs <= 0) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, autoIntervalMs);
    return () => window.clearInterval(id);
  }, [total, autoIntervalMs]);

  if (total === 0) return null;

  const goPrev = () => setIndex((i) => (i - 1 + total) % total);
  const goNext = () => setIndex((i) => (i + 1) % total);

  return (
    <div className="relative overflow-hidden">
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {images.map((src, i) => (
          <div key={`${src}-${i}`} className="w-full shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className="block aspect-[16/9] w-full object-cover md:aspect-[21/9]"
            />
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="前へ"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 md:left-4"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="次へ"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 md:right-4"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${i + 1}枚目`}
                className={
                  "h-2 w-2 rounded-full transition " +
                  (i === index
                    ? "bg-white"
                    : "bg-white/50 hover:bg-white/80")
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
