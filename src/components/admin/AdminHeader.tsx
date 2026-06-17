"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "./adminNav";

export function AdminHeader({
  name,
  role,
}: {
  name: string;
  role: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // ページ遷移したらドロワーを閉じる
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="flex h-16 items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 md:px-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-ml-1 inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 md:hidden"
          aria-label="メニューを開く"
        >
          <HamburgerIcon />
        </button>
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-2 md:hidden"
        >
          <span className="text-lg font-extrabold text-brand-600">Avelia</span>
          <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">
            ADMIN
          </span>
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-gray-800">{name}</p>
          <p className="text-xs text-gray-400">{role}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          ログアウト
        </button>
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        side="left"
        title={
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2"
          >
            <span className="text-lg font-extrabold text-brand-600">Avelia</span>
            <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">
              ADMIN
            </span>
          </Link>
        }
      >
        <div className="border-b border-gray-100 px-4 py-3 sm:hidden">
          <p className="text-sm font-semibold text-gray-800">{name}</p>
          <p className="text-xs text-gray-400">{role}</p>
        </div>
        <nav className="space-y-5 px-3 py-4">
          {ADMIN_NAV.map((g) => (
            <div key={g.title}>
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {g.title}
              </p>
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium",
                        active
                          ? "bg-brand-50 text-brand-700"
                          : "text-gray-700 hover:bg-gray-50",
                      )}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
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
