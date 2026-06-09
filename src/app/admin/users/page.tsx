import { Card, CardBody } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdminPage("MANAGER");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      orders: { where: { status: "PAID" }, select: { total: true } },
      _count: { select: { orders: true } },
    },
  });

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name ?? "-",
    orderCount: u._count.orders,
    paidTotal: u.orders.reduce((s, o) => s + o.total, 0),
    createdAt: u.createdAt,
  }));

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { key: "email", header: "メール" },
    { key: "name", header: "名前" },
    { key: "orderCount", header: "注文数", align: "right" },
    {
      key: "paidTotal",
      header: "購入金額(支払済)",
      align: "right",
      cell: (u) => formatYen(u.paidTotal),
    },
    { key: "createdAt", header: "登録日", cell: (u) => formatDateTime(u.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
      <Card>
        <CardBody>
          <DataTable columns={columns} rows={rows} emptyMessage="ユーザーがいません" />
        </CardBody>
      </Card>
    </div>
  );
}
