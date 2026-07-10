import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { deleteNewsPost, toggleNewsPublish } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEWS | 管理" };

export default async function AdminNewsListPage() {
  await requireAdminPage("OPERATOR");
  const posts = await prisma.newsPost.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NEWS</h1>
          <p className="text-sm text-gray-500">
            サイトの NEWS / お知らせを管理します。
          </p>
        </div>
        <Button href="/admin/news/new">＋ 新規作成</Button>
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardBody className="text-center text-sm text-gray-400">
            まだ NEWS はありません
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2">公開日</th>
                  <th className="px-4 py-2">タイトル</th>
                  <th className="px-4 py-2">slug</th>
                  <th className="px-4 py-2">状態</th>
                  <th className="px-4 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {p.publishedAt ? formatDateTime(p.publishedAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/news/${p.id}`}
                        className="font-medium text-gray-900 hover:text-brand-600"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {p.slug}
                    </td>
                    <td className="px-4 py-3">
                      {p.isPublished ? (
                        <Badge color="green">公開中</Badge>
                      ) : (
                        <Badge color="gray">下書き</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <form action={toggleNewsPublish}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            {p.isPublished ? "下書きに戻す" : "公開する"}
                          </button>
                        </form>
                        <Link
                          href={`/admin/news/${p.id}`}
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          編集
                        </Link>
                        <form action={deleteNewsPost}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            削除
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
