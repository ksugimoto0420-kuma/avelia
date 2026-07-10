import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEWS | Avelia FunClub" };

/**
 * #62: NEWS 一覧ページ。publishedAt 未来分は非表示。
 */
export default async function NewsListPage() {
  const now = new Date();
  const posts = await prisma.newsPost.findMany({
    where: {
      isPublished: true,
      publishedAt: { not: null, lte: now },
    },
    orderBy: { publishedAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">NEWS</h1>
      <p className="mt-1 text-sm text-gray-500">
        運営からのお知らせを掲載しています。
      </p>

      {posts.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
          掲載中のお知らせはありません
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-gray-100 border-y border-gray-100">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/news/${p.slug}`}
                className="flex items-baseline gap-4 py-4 hover:bg-gray-50"
              >
                <time
                  className="w-24 shrink-0 text-xs font-medium tracking-wider text-gray-500"
                  dateTime={p.publishedAt?.toISOString() ?? undefined}
                >
                  {formatDate(p.publishedAt)}
                </time>
                <p className="text-sm text-gray-900 hover:text-brand-600">
                  {p.title}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
