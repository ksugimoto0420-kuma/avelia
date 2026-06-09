import { Card, CardBody } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOperationLogsPage() {
  await requireAdminPage("MANAGER");

  const logs = await prisma.operationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { adminUser: { select: { name: true, email: true } } },
  });

  type Row = (typeof logs)[number];
  const columns: Column<Row>[] = [
    { key: "createdAt", header: "日時", cell: (l) => formatDateTime(l.createdAt) },
    {
      key: "admin",
      header: "操作者",
      cell: (l) => l.adminUser?.name ?? l.adminUser?.email ?? "システム",
    },
    {
      key: "action",
      header: "操作",
      cell: (l) => <code className="text-xs">{l.action}</code>,
    },
    {
      key: "target",
      header: "対象",
      cell: (l) =>
        l.targetType ? `${l.targetType}#${l.targetId ?? ""}` : "-",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">操作ログ</h1>
      <p className="text-sm text-gray-500">
        管理者操作の監査ログです（仕様書 15. セキュリティ要件）。
      </p>
      <Card>
        <CardBody>
          <DataTable columns={columns} rows={logs} emptyMessage="ログがありません" />
        </CardBody>
      </Card>
    </div>
  );
}
