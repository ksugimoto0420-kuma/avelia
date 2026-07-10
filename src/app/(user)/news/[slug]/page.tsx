import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * #62: NEWS 詳細ページ。slug ベースで公開済みのみ表示。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await prisma.newsPost.findUnique({ where: { slug } });
  if (!post) return { title: "NEWS" };
  return { title: `${post.title} | NEWS | Avelia FunClub` };
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await prisma.newsPost.findUnique({ where: { slug } });
  const now = new Date();
  if (
    !post ||
    !post.isPublished ||
    !post.publishedAt ||
    post.publishedAt > now
  ) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/news"
        className="text-xs text-gray-500 hover:text-brand-600"
      >
        ← NEWS一覧に戻る
      </Link>

      <time
        className="mt-4 block text-xs font-medium tracking-wider text-gray-500"
        dateTime={post.publishedAt.toISOString()}
      >
        {formatDate(post.publishedAt)}
      </time>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">{post.title}</h1>

      <div className="mt-8 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
        {post.body}
      </div>
    </article>
  );
}
