"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * /talent 配下のレイアウトシェル。
 * pathname に応じてヘッダーの有無 / スクロール抑止を切り替える。
 *
 * - /talent/sign/* : ヘッダー非表示 + overflow-hidden で画面全体をキャンバスに
 *   (SignSession が fixed inset-0 でフルスクリーン表示する)
 * - それ以外       : TalentHeader を表示、通常のスクロール可
 */
export function TalentLayoutShell({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isSignPage = pathname?.startsWith("/talent/sign/") ?? false;

  if (isSignPage) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-brand-50 to-white">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-brand-50 to-white">
      {header}
      <main className="flex-1">{children}</main>
    </div>
  );
}
