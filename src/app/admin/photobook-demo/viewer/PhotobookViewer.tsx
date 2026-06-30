"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookStage, type BookStageHandle } from "./BookStage";
import { PageNavigationHitArea } from "./PageNavigationHitArea";
import { ThumbnailStrip } from "./ThumbnailStrip";
import { ViewerFooter } from "./ViewerFooter";
import { ViewerHeader } from "./ViewerHeader";
import type { ViewerPage, ViewerSignature } from "./types";

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
  // currentPage は「現在の左ページ番号（1始まり）」。
  // react-pageflip の onFlip が真実の状態管理を担う。
  const [currentPage, setCurrentPage] = useState(1);
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [isThumbnailOpen, setIsThumbnailOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const signatures = useMemo(() => {
    const m = new Map<number, ViewerSignature>();
    for (const s of signatureList) m.set(s.pageNumber, s);
    return m;
  }, [signatureList]);

  // ステージへの ref（外部からめくり操作するため）
  const stageRef = useRef<BookStageHandle | null>(null);

  // 1024px以上は見開き優先（react-pageflip の usePortrait が幅で自動切替）
  // canSpread は Footer の見開き切替表示のため、念のため保持
  const [canSpread, setCanSpread] = useState(false);
  useEffect(() => {
    const detect = () => setCanSpread(window.innerWidth >= 768);
    detect();
    window.addEventListener("resize", detect);
    return () => window.removeEventListener("resize", detect);
  }, []);

  /* ----------------- ページ送り（BookStage に委譲） ----------------- */
  const goNext = useCallback(() => {
    stageRef.current?.flipNext();
  }, []);
  const goPrev = useCallback(() => {
    stageRef.current?.flipPrev();
  }, []);
  const goTo = useCallback(
    (pageNumber: number) => {
      const safe = Math.max(1, Math.min(pages.length, pageNumber));
      stageRef.current?.turnTo(safe - 1);
    },
    [pages.length],
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
      else if (e.key === "+" || e.key === "=")
        setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)));
      else if (e.key === "-" || e.key === "_")
        setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)));
      else if (e.key === "0") setZoom(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose, wakeUi]);

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
  // 次/前のページ画像を Image で事前デコード
  useEffect(() => {
    const targets = [
      currentPage + 1,
      currentPage + 2,
      currentPage - 1,
      currentPage - 2,
    ];
    for (const n of targets) {
      const p = pages.find((x) => x.pageNumber === n);
      if (p) {
        const img = new Image();
        img.src = p.dataUrl;
      }
    }
  }, [currentPage, pages]);

  // ラベル: 写真集の並び（[白紙|表紙] [P2|P3] [P4|P5] ...）を考慮:
  //   表紙の見開き (currentPage=1) → "1"
  //   それ以降は偶数ページが左、奇数ページが右 → "2–3" "4–5" ...
  //   末尾が奇数で [Pn|白紙] になる場合は "n"
  // canSpread=false（スマホ縦持ち）の時は常に単一ページ番号
  let currentLabel: string;
  if (!canSpread || currentPage === 1) {
    currentLabel = `${currentPage}`;
  } else if (currentPage % 2 === 0) {
    // 偶数: 左ページ → "n–(n+1)"。次が存在しなければ単独
    const right = currentPage + 1;
    currentLabel =
      right <= pages.length ? `${currentPage}–${right}` : `${currentPage}`;
  } else {
    // 奇数（右ページ）→ "(n-1)–n"
    currentLabel = `${currentPage - 1}–${currentPage}`;
  }

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
      onTouchStart={wakeUi}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ViewerHeader title={title} visible={isUiVisible} onClose={onClose} />

      <div className="absolute inset-0">
        <BookStage
          ref={stageRef}
          pages={pages}
          signatures={signatures}
          watermark={watermark}
          currentPage={currentPage}
          onFlipped={(n) => setCurrentPage(n)}
          zoom={zoom}
          onZoomChange={(z) => setZoom(z)}
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
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))}
        onZoomOut={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}
        onZoomReset={() => setZoom(1)}
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
