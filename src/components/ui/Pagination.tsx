import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * クエリ文字列ベースのページネーション。
 * buildHref(page) で各ページの遷移先 URL を生成する。
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  const itemCls = (active: boolean) =>
    cn(
      "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm",
      active
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    );

  return (
    <nav className="flex items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={buildHref(page - 1)} className={itemCls(false)}>
          ‹
        </Link>
      )}
      {start > 1 && (
        <>
          <Link href={buildHref(1)} className={itemCls(false)}>
            1
          </Link>
          {start > 2 && <span className="px-1 text-gray-400">…</span>}
        </>
      )}
      {pages.map((p) => (
        <Link key={p} href={buildHref(p)} className={itemCls(p === page)}>
          {p}
        </Link>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-gray-400">…</span>}
          <Link href={buildHref(totalPages)} className={itemCls(false)}>
            {totalPages}
          </Link>
        </>
      )}
      {page < totalPages && (
        <Link href={buildHref(page + 1)} className={itemCls(false)}>
          ›
        </Link>
      )}
    </nav>
  );
}
