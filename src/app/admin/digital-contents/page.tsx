import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  IMAGE: "画像",
  VIDEO: "動画",
  AUDIO: "音声",
  FILE: "ファイル",
};

export default async function AdminDigitalContentsPage() {
  await requireAdminPage();

  const contents = await prisma.digitalContent.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { name: true } },
      _count: { select: { userGrants: true } },
    },
  });

  type Row = (typeof contents)[number];
  const columns: Column<Row>[] = [
    { key: "title", header: "タイトル", cell: (c) => c.title },
    {
      key: "type",
      header: "種別",
      cell: (c) => <Badge color="purple">{TYPE_LABEL[c.type]}</Badge>,
    },
    { key: "product", header: "紐づけ商品", cell: (c) => c.product?.name ?? "-" },
    {
      key: "grants",
      header: "付与数",
      align: "right",
      cell: (c) => c._count.userGrants,
    },
    {
      key: "limit",
      header: "制限",
      cell: (c) =>
        [
          c.viewLimitDays ? `${c.viewLimitDays}日` : null,
          c.downloadLimit ? `DL${c.downloadLimit}回` : null,
        ]
          .filter(Boolean)
          .join(" / ") || "なし",
    },
    { key: "createdAt", header: "登録日", cell: (c) => formatDateTime(c.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          デジタルコンテンツ管理
        </h1>
        <Button href="/admin/digital-contents/new">＋ 新規登録</Button>
      </div>
      <Card>
        <CardBody>
          <DataTable
            columns={columns}
            rows={contents}
            emptyMessage="コンテンツがありません"
          />
        </CardBody>
      </Card>
    </div>
  );
}
