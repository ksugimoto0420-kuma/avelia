"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/mypage", label: "概要" },
  { href: "/mypage/orders", label: "注文履歴" },
  { href: "/mypage/digital-contents", label: "デジタルコンテンツ" },
  { href: "/mypage/lottery-results", label: "抽選結果" },
  { href: "/mypage/profile", label: "会員情報" },
];

export function MypageNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 border-b border-gray-100 pb-3">
      {ITEMS.map((item) => {
        const active =
          item.href === "/mypage"
            ? pathname === "/mypage"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium",
              active
                ? "bg-brand-600 text-white"
                : "text-gray-600 hover:bg-gray-100",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
