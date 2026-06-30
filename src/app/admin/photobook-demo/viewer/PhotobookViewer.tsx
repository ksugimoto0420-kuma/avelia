"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageStage } from "./PageStage";
import { PageNavigationHitArea } from "./PageNavigationHitArea";
import { ThumbnailStrip } from "./ThumbnailStrip";
import { ViewerFooter } from "./ViewerFooter";
import { ViewerHeader } from "./ViewerHeader";
import type {
  ViewerMode,
  ViewerPage,
  ViewerSignature,
} from "./types";

/**
 * デジタル写真集ビューア本体。
 *
 * 設計方針（指示書より）:
 *   - 高級感・余白がきれい・写真が主役
 *   - 操作 UI は控えめ、操作後 2.5 秒で自動的に薄れる
 *   - スマホ: 1ページ、横スワイプ、タップで UI 表示切替
 *   - PC/タブレット: 見開き、左右クリック、矢印キー
 *   - 1024px 以上では自動的に見開き優先
 *
 * 操作:
 *   ←→ / 画面左右クリック / 横スワイプ: ページ送り
 *   タップ（中央）: UI 表示切替
 *   ESC: 閉じる
 *   ダブルクリック / 「+」「−」: 拡大/縮小
 *
 * コピー対策:
 *   - 右クリック・ドラッグ・選択を抑制
 *   - 半透明の購入者透かしを全面に重ねる（薄め）
 */
export function PhotobookViewer({
  pages,
  signatures: signatureList,
  title,
  watermark,
  onClose,
}: {
  pages: ViewerPage[];
  signatures: ViewerSignature[];
  title?: string;
  /** 購入者名・メールなど。設定すると薄い透かしとして全面に表示。 */
  watermark?: string | null;
  /** 閉じる時のコールバック（ESCで発火、ヘッダーの戻るで発火） */
  onClose: () => void;
}) {
  // currentPage は「現在表示中の先頭ページ番号」。見開きの場合は左ページ番号。
  const [currentPage, setCurrentPage] = useState(1);
  const [mode, setMode] = useState<ViewerMode>("single");
  const [zoom, setZoom] = useState(1);
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [isThumbnailOpen, setIsThumbnailOpen] = useState(false);
  const [transition, setTransition] = useState<"none" | "next" | "prev">(
    "none",
  );

  const signatures = useMemo(() => {
    const m = new Map<number, ViewerSignature>();
    for (const s of signatureList) m.set(s.pageNumber, s);
    return m;
  }, [signatureList]);

  // 画面幅でモード初期値を決める（1024px以上は見開きを優先）
  useEffect(() => {
    const detect = () => {
      const isWide = window.innerWidth >= 1024;
      setMode(isWide ? "spread" : "single");
    };
    detect();
    window.addEventListener("resize", detect);
    return () => window.removeEventListener("resize", detect);
  }, []);

  const canSpread = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 768;
  }, []);

  /* ----------------- ページ送り ----------------- */
  const goNext = useCallback(() => {
    setCurrentPage((cp) => {
      if (mode === "spread") {
        // 表紙(1) → 2 → 4 → 6 ...
        const target = cp === 1 ? 2 : cp + 2;
        if (target > pages.length) return cp;
        return target;
      }
      return Math.min(pages.length, cp + 1);
    });
    setTransition("next");
    window.setTimeout(() => setTransition("none"), 240);
  }, [mode, pages.length]);

  const goPrev = useCallback(() => {
    setCurrentPage((cp) => {
      if (mode === "spread") {
        if (cp <= 1) return cp;
        return cp <= 2 ? 1 : cp - 2;
      }
      return Math.max(1, cp - 1);
    });
    setTransition("prev");
    window.setTimeout(() => setTransition("none"), 240);
  }, [mode]);

  const goTo = useCallback(
    (pageNumber: number) => {
      const safe = Math.max(1, Math.min(pages.length, pageNumber));
      if (mode === "spread" && safe > 1) {
        // 偶数開始の見開きにスナップ
        const target = safe - (safe % 2);
        setCurrentPage(Math.max(1, target));
      } else {
        setCurrentPage(safe);
      }
    },
    [mode, pages.length],
  );

  /* ----------------- UI 自動隠し ----------------- */
  const hideTimerRef = useRef<number | null>(null);
  const wakeUi = useCallback(() => {
    setIsUiVisible(true);
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setIsUiVisible(false);
    }, 2500);
  }, []);

  useEffect(() => {
    wakeUi();
    return () => {
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [wakeUi]);

  /* ----------------- キーボード ----------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      wakeUi();
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose, wakeUi]);

  /* ----------------- スワイプ ----------------- */
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(
    null,
  );
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.t;
    touchStartRef.current = null;
    // タップ判定（指の移動が小さく、時間が短い）
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 250) {
      setIsUiVisible((v) => !v);
      return;
    }
    // スワイプ判定
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  /* ----------------- Mac トラックパッド対策 ----------------- */
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (
        Math.abs(e.deltaX) > Math.abs(e.deltaY) &&
        Math.abs(e.deltaX) > 10
      ) {
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ----------------- プリロード ----------------- */
  // 次/前のページ画像を img の HTTP リクエストとして事前ロード（dataUrl は即時）
  // dataUrl は文字列なのでロード待ちはないが、img onload を発火させて
  // ブラウザ内デコードを促す。
  useEffect(() => {
    const preloadPages: number[] = [];
    if (mode === "single") {
      preloadPages.push(currentPage + 1, currentPage - 1);
    } else {
      preloadPages.push(currentPage + 2, currentPage - 2);
    }
    for (const n of preloadPages) {
      const p = pages.find((x) => x.pageNumber === n);
      if (p) {
        const img = new Image();
        img.src = p.dataUrl;
      }
    }
  }, [currentPage, mode, pages]);

  const currentLabel =
    mode === "spread" && currentPage > 1
      ? `${currentPage}–${Math.min(pages.length, currentPage + 1)}`
      : `${currentPage}`;

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden bg-black [touch-action:pan-y] [overscroll-behavior:contain]"
      onClick={(e) => {
        // 中央エリアのクリックで UI 切替（左右クリックは HitArea で処理済み）
        const target = e.target as HTMLElement;
        if (target.closest("button")) return;
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const w = rect.width;
        const x = e.clientX - rect.left;
        if (x > w * 0.25 && x < w * 0.75) {
          setIsUiVisible((v) => !v);
        }
        wakeUi();
      }}
      onMouseMove={wakeUi}
      onTouchStart={(e) => {
        wakeUi();
        onTouchStart(e);
      }}
      onTouchEnd={onTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ViewerHeader title={title} visible={isUiVisible} onClose={onClose} />

      <div className="absolute inset-0">
        <PageStage
          pages={pages}
          currentPage={currentPage}
          mode={mode}
          signatures={signatures}
          watermark={watermark}
          transition={transition}
        />
      </div>

      <PageNavigationHitArea
        onPrev={goPrev}
        onNext={goNext}
        visible={isUiVisible}
      />

      <ViewerFooter
        currentLabel={currentLabel}
        totalPages={pages.length}
        visible={isUiVisible}
        isSpread={mode === "spread"}
        canSpread={canSpread}
        onToggleSpread={() => setMode(mode === "spread" ? "single" : "spread")}
        onZoomIn={() => setZoom(Math.min(2.5, +(zoom + 0.1).toFixed(2)))}
        onZoomOut={() => setZoom(Math.max(0.6, +(zoom - 0.1).toFixed(2)))}
        zoom={zoom}
        onOpenThumbs={() => setIsThumbnailOpen(true)}
      />

      <ThumbnailStrip
        open={isThumbnailOpen}
        pages={pages}
        signatures={signatures}
        currentPage={currentPage}
        onClose={() => setIsThumbnailOpen(false)}
        onJump={(n) => goTo(n)}
      />
    </div>
  );
}
