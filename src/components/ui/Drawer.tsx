"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * 画面端からスライドインするドロワー。モバイルナビゲーション等に利用。
 */
export function Drawer({
  open,
  onClose,
  side = "left",
  title,
  children,
  widthClassName,
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title?: React.ReactNode;
  children: React.ReactNode;
  widthClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute top-0 bottom-0 flex w-full flex-col bg-white shadow-xl transition-transform duration-200",
          widthClassName ?? "max-w-xs",
          side === "left" ? "left-0" : "right-0",
          open
            ? "translate-x-0"
            : side === "left"
              ? "-translate-x-full"
              : "translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4">
          <div className="font-semibold text-gray-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
