"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

type ToastCtx = {
  show: (message: string, tone?: Toast["tone"]) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast は ToastProvider 内で使用してください");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback(
    (message: string, tone: Toast["tone"] = "success") => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((t) => [...t, { id, message, tone }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 3500);
    },
    [],
  );

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-lg px-4 py-3 text-sm text-white shadow-lg",
              t.tone === "success" && "bg-green-600",
              t.tone === "error" && "bg-red-600",
              t.tone === "info" && "bg-gray-800",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
