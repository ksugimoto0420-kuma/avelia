"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";

// #62: corazon 風のシンプル構成。イベント一覧はトップに集約したため
// カテゴリタブは削除し、運営情報系のみ並べる。
const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/news", label: "NEWS" },
  { href: "/faq", label: "よくある質問" },
  { href: "/contact", label: "お問い合わせ" },
];

export function UserHeader() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [open, setOpen] = useState(false);

  const refreshCart = useCallback(() => {
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

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  // 他コンポーネントからの「カート更新通知」を受け取って再取得
  useEffect(() => {
    const onUpdated = () => refreshCart();
    window.addEventListener("cart:updated", onUpdated);
    // 別タブでカートが更新された時にも反映（戻ってきた時の整合性）
    const onFocus = () => refreshCart();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("cart:updated", onUpdated);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshCart]);

  // ページ遷移したらドロワーを閉じる
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isUser = session?.user?.kind === "user";

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 md:hidden"
            aria-label="メニューを開く"
          >
            <HamburgerIcon />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-brand-600">
              Avelia
            </span>
            <span className="hidden text-sm font-semibold text-gray-400 sm:inline">
              FunClub
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-brand-600">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 text-sm sm:gap-3">
          <Link
            href="/cart"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
            aria-label="カート"
          >
            <CartIcon />
            {cartCount > 0 && (
              <span className="absolute right-0 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold leading-none text-white shadow">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
          {isUser ? (
            <>
              <Link
                href="/mypage"
                className="hidden rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100 sm:inline-block"
              >
                マイページ
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="hidden rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100 sm:inline-block"
              >
                ログアウト
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-lg bg-brand-600 px-3 py-2 font-medium text-white hover:bg-brand-700 sm:px-4"
            >
              ログイン
            </Link>
          )}
        </div>
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        side="left"
        title={
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-extrabold text-brand-600">Avelia</span>
            <span className="text-sm font-semibold text-gray-400">FunClub</span>
          </Link>
        }
      >
        <nav className="flex flex-col p-2 text-sm">
          <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            探す
          </p>
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2.5 font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
            >
              {l.label}
            </Link>
          ))}

          <p className="px-3 pb-1 pt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            アカウント
          </p>
          <Link
            href="/cart"
            className="rounded-lg px-3 py-2.5 font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
          >
            カート{cartCount > 0 ? `（${cartCount}）` : ""}
          </Link>
          {isUser ? (
            <>
              <Link
                href="/mypage"
                className="rounded-lg px-3 py-2.5 font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
              >
                マイページ
              </Link>
              <Link
                href="/mypage/orders"
                className="rounded-lg px-3 py-2.5 font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
              >
                注文履歴
              </Link>
              <Link
                href="/mypage/lottery-results"
                className="rounded-lg px-3 py-2.5 font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
              >
                抽選結果
              </Link>
              <Link
                href="/mypage/digital-contents"
                className="rounded-lg px-3 py-2.5 font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
              >
                デジタルコンテンツ
              </Link>
              <Link
                href="/mypage/profile"
                className="rounded-lg px-3 py-2.5 font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
              >
                プロフィール
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="mt-1 rounded-lg px-3 py-2.5 text-left font-medium text-gray-500 hover:bg-gray-100"
              >
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="mt-1 rounded-lg bg-brand-600 px-3 py-2.5 text-center font-medium text-white hover:bg-brand-700"
              >
                ログイン
              </Link>
              <Link
                href="/auth/register"
                className="mt-2 rounded-lg border border-gray-300 px-3 py-2.5 text-center font-medium text-gray-700 hover:bg-gray-50"
              >
                新規登録
              </Link>
            </>
          )}

          <p className="px-3 pb-1 pt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            サポート
          </p>
          <Link
            href="/contact"
            className="rounded-lg px-3 py-2.5 font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
          >
            お問い合わせ
          </Link>
        </nav>
      </Drawer>
    </header>
  );
}

function HamburgerIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L21 8H6" />
      <circle cx="10" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </svg>
  );
}
