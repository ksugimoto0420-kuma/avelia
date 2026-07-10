import { notFound } from "next/navigation";
import {
  NewsPostForm,
  type NewsPostFormData,
} from "@/components/admin/NewsPostForm";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEWS編集 | 管理" };

export default async function EditNewsPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const { postId } = await params;
  const post = await prisma.newsPost.findUnique({ where: { id: postId } });
  if (!post) notFound();

  const initial: NewsPostFormData = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    body: post.body,
    isPublished: post.isPublished,
    publishedAt: post.publishedAt,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">NEWS 編集</h1>
      <NewsPostForm post={initial} />
    </div>
  );
}
