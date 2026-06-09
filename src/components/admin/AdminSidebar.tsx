"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const GROUPS: { title: string; items: { href: string; label: string; icon: string }[] }[] =
  [
    {
      title: "概要",
      items: [{ href: "/admin/dashboard", label: "ダッシュボード", icon: "📊" }],
    },
    {
      title: "販売管理",
      items: [
        { href: "/admin/events", label: "イベント", icon: "🎫" },
        { href: "/admin/products", label: "商品", icon: "🎁" },
        { href: "/admin/inventories", label: "在庫", icon: "📦" },
        { href: "/admin/lotteries", label: "抽選", icon: "🎰" },
      ],
    },
    {
      title: "注文・決済",
      items: [
        { href: "/admin/orders", label: "注文", icon: "🧾" },
        { href: "/admin/payments", label: "決済", icon: "💳" },
      ],
    },
    {
      title: "コンテンツ",
      items: [
        { href: "/admin/digital-contents", label: "デジタルコンテンツ", icon: "🎬" },
        { href: "/admin/digital-deliveries", label: "サイン納品", icon: "✍️" },
      ],
    },
    {
      title: "ロジ・収益",
      items: [
        { href: "/admin/exports/production-list", label: "制作リスト", icon: "🛠" },
        { href: "/admin/exports/shipping-list", label: "発送リスト", icon: "🚚" },
        { href: "/admin/revenue-shares", label: "R/S売上", icon: "💴" },
      ],
    },
    {
      title: "サイト運営",
      items: [
        { href: "/admin/faqs", label: "FAQ", icon: "❓" },
        { href: "/admin/contact-messages", label: "お問い合わせ", icon: "✉️" },
      ],
    },
    {
      title: "システム",
      items: [
        { href: "/admin/users", label: "ユーザー", icon: "👥" },
        { href: "/admin/operation-logs", label: "操作ログ", icon: "📝" },
      ],
    },
  ];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-gray-200 bg-white md:block">
      <div className="px-5 py-5">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-brand-600">Avelia</span>
          <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">
            ADMIN
          </span>
        </Link>
      </div>
      <nav className="space-y-5 px-3 pb-10">
        {GROUPS.map((g) => (
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
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium",
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-gray-600 hover:bg-gray-50",
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
    </aside>
  );
}
