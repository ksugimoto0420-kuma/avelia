"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MediaImage } from "@/components/ui/MediaImage";
import { Badge } from "@/components/ui/Badge";

/**
 * アベリアくじ ガチャ演出 + 結果表示。
 *
 * 演出はシンプルなSVGアニメーション:
 *   - カプセル落下
 *   - フラッシュ
 *   - 賞のフェードイン
 *
 * 連数の場合は 1 件ずつ「次へ」で進めるか、「全部見る」でリストにまとめて表示。
 */

type Draw = {
  id: string;
  prize: {
    rank: string;
    name: string;
    imageUrl: string | null;
    variantNote: string | null;
  };
  isBundleBonus: boolean;
};

type Phase = "intro" | "drop" | "flash" | "reveal" | "done";

export function KujiResultClient({
  campaignTitle,
  campaignId,
  orderNumber,
  draws,
}: {
  campaignTitle: string;
  campaignId: string;
  orderNumber: string;
  draws: Draw[];
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [showAll, setShowAll] = useState(false);

  const current = draws[index];
  const isLast = index >= draws.length - 1;

  // 演出シーケンス
  useEffect(() => {
    if (showAll) return;
    setPhase("intro");
    const t1 = setTimeout(() => setPhase("drop"), 200);
    const t2 = setTimeout(() => setPhase("flash"), 900);
    const t3 = setTimeout(() => setPhase("reveal"), 1300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [index, showAll]);

  // 集計
  const summary = useMemo(() => {
    const map = new Map<string, { rank: string; name: string; count: number }>();
    for (const d of draws) {
      const key = `${d.prize.rank}|${d.prize.name}`;
      const cur = map.get(key);
      if (cur) cur.count += 1;
      else
        map.set(key, {
          rank: d.prize.rank,
          name: d.prize.name,
          count: 1,
        });
    }
    return Array.from(map.values()).sort((a, b) => a.rank.localeCompare(b.rank));
  }, [draws]);

  const advance = () => {
    if (isLast) {
      setShowAll(true);
      return;
    }
    setIndex((i) => i + 1);
  };

  if (draws.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p>抽選結果が見つかりません</p>
      </div>
    );
  }

  if (showAll) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">{campaignTitle}</h1>
          <p className="text-sm text-gray-500">
            注文番号: {orderNumber} ／ 全 {draws.length} 件
          </p>
        </header>

        {/* 集計 */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-700">📊 当選サマリ</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {summary.map((s) => (
              <li key={`${s.rank}-${s.name}`}>
                <b className="text-pink-600">{s.rank}賞</b>{" "}
                <span className="text-gray-700">{s.name}</span> ×{" "}
                <b>{s.count}</b>
              </li>
            ))}
          </ul>
        </section>

        {/* 1件ずつ */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {draws.map((d, i) => (
            <div
              key={d.id}
              className="rounded-xl border border-gray-200 bg-white p-2"
            >
              <MediaImage
                src={d.prize.imageUrl}
                alt={d.prize.name}
                aspect="1/1"
              />
              <p className="mt-1 text-[11px] text-gray-400">#{i + 1}</p>
              <p className="text-xs font-bold">
                <span className="text-pink-600">{d.prize.rank}賞</span>
              </p>
              <p className="text-xs text-gray-700">{d.prize.name}</p>
              {d.isBundleBonus && (
                <Badge color="yellow">連数オマケ</Badge>
              )}
            </div>
          ))}
        </section>

        <div className="flex justify-center gap-3">
          <Link
            href={`/kuji/${campaignId}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            くじページに戻る
          </Link>
          <Link
            href="/mypage/orders"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
          >
            注文履歴を見る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <header className="mb-3 text-center">
        <p className="text-xs text-gray-500">{campaignTitle}</p>
        <p className="text-sm font-bold text-gray-700">
          {index + 1} / {draws.length} 回目
        </p>
      </header>

      <div className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-pink-100 to-purple-100">
        {/* カプセル落下 */}
        {(phase === "intro" || phase === "drop") && (
          <svg
            viewBox="0 0 200 200"
            className={
              "h-3/4 w-3/4 transition-transform duration-700 ease-out " +
              (phase === "drop"
                ? "translate-y-0"
                : "-translate-y-[120%]")
            }
          >
            <defs>
              <linearGradient id="cap1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
              <linearGradient id="cap2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="78" fill="url(#cap1)" />
            <path
              d="M22,100 a78,78 0 0 1 156,0 z"
              fill="url(#cap2)"
              opacity="0.95"
            />
            <ellipse cx="80" cy="70" rx="14" ry="10" fill="#fff" opacity="0.6" />
          </svg>
        )}

        {/* フラッシュ */}
        {phase === "flash" && (
          <div className="absolute inset-0 animate-pulse bg-white opacity-90" />
        )}

        {/* 結果表示 */}
        {phase === "reveal" && current && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center animate-[fadeIn_400ms_ease-out]">
            <Badge color="pink">
              {current.isBundleBonus ? "連数オマケ" : "当選"}
            </Badge>
            <p className="mt-2 text-4xl font-extrabold text-pink-600">
              {current.prize.rank}賞
            </p>
            <p className="mt-1 text-base font-bold text-gray-800">
              {current.prize.name}
            </p>
            {current.prize.variantNote && (
              <p className="mt-1 text-xs text-gray-500">
                {current.prize.variantNote}
              </p>
            )}
            {current.prize.imageUrl && (
              <div className="mt-3 w-32">
                <MediaImage
                  src={current.prize.imageUrl}
                  alt={current.prize.name}
                  aspect="1/1"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={advance}
          disabled={phase !== "reveal"}
          className="rounded-lg bg-pink-600 px-5 py-2 text-sm font-bold text-white hover:bg-pink-700 disabled:opacity-40"
        >
          {isLast ? "全部見る →" : "次へ →"}
        </button>
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          スキップ
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
