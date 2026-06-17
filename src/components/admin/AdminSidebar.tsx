"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "./adminNav";

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
