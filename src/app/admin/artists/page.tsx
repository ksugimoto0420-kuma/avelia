import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "アーティスト管理" };

export default async function AdminArtistsPage() {
  await requireAdminPage("OPERATOR");

  const artists = await prisma.artist.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { events: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">アーティスト管理</h1>
          <p className="text-sm text-gray-500">
            出演者のマスタ情報。イベントにアーティストを紐付けると、表記揺れを防ぎ専用ページにまとまります。
          </p>
        </div>
        <Button href="/admin/artists/new">＋ 新規アーティスト</Button>
      </div>

      <Card>
        <CardHeader title={`登録済みアーティスト（${artists.length}件）`} />
        <CardBody className="px-0 py-0">
          {artists.length === 0 ? (
            <p className="px-5 py-12 text-center text-gray-400">
              まだ登録されたアーティストがいません
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 text-left">名前</th>
                  <th className="px-4 py-3 text-left">slug</th>
                  <th className="px-4 py-3 text-right">紐づくイベント</th>
                  <th className="px-4 py-3 text-left">状態</th>
                  <th className="px-4 py-3 text-left">作成日</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {artists.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/artists/${a.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {a.name}
                      </Link>
                      {a.nameKana && (
                        <p className="text-xs text-gray-400">{a.nameKana}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {a.slug}
                    </td>
                    <td className="px-4 py-3 text-right">{a._count.events}</td>
                    <td className="px-4 py-3">
                      {a.isPublished ? (
                        <Badge color="green">公開中</Badge>
                      ) : (
                        <Badge color="gray">非公開</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDateTime(a.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        href={`/admin/artists/${a.id}`}
                        variant="outline"
                        size="sm"
                      >
                        編集
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
