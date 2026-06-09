"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export function UserHeader() {
  const { data: session } = useSession();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (session?.user?.kind !== "user") {
      setCartCount(0);
      return;
    }
    fetch("/api/cart")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const items = json?.data?.items ?? [];
        const count = items.reduce(
          (s: number, i: { quantity: number }) => s + i.quantity,
          0,
        );
        setCartCount(count);
      })
      .catch(() => {});
  }, [session]);

  const isUser = session?.user?.kind === "user";

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-extrabold tracking-tight text-brand-600">
            Avelia
          </span>
          <span className="text-sm font-semibold text-gray-400">FunClub</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 md:flex">
          <Link href="/events?type=MEET_GREET" className="hover:text-brand-600">
            オンライン特典会
          </Link>
          <Link href="/events?type=KUJI" className="hover:text-brand-600">
            すきくじ
          </Link>
          <Link href="/events?type=TRADING_CARD" className="hover:text-brand-600">
            トレカ
          </Link>
          <Link href="/faq" className="hover:text-brand-600">
            よくある質問
          </Link>
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/cart"
            className="relative rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100"
          >
            🛒
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
          {isUser ? (
            <>
              <Link
                href="/mypage"
                className="rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100"
              >
                マイページ
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100"
              >
                ログアウト
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
            >
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
