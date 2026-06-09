import Link from "next/link";
import { DashboardCard } from "@/components/admin/DashboardCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { Alert } from "@/components/ui/Alert";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdminPage();
  const now = new Date();

  const [sales, paidCount, pendingCount, onSaleEvents, unfulfilled, recent] =
    await Promise.all([
      prisma.order.aggregate({
        where: { status: "PAID" },
        _sum: { total: true },
      }),
      prisma.order.count({ where: { status: "PAID" } }),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.event.count({
        where: {
          isPublished: true,
          AND: [
            { OR: [{ saleStartAt: null }, { saleStartAt: { lte: now } }] },
            { OR: [{ saleEndAt: null }, { saleEndAt: { gte: now } }] },
          ],
        },
      }),
      prisma.shipment.count({ where: { status: "UNFULFILLED" } }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: { select: { email: true } } },
      }),
    ]);

  type Row = (typeof recent)[number];
  const columns: Column<Row>[] = [
    {
      key: "orderNumber",
      header: "注文番号",
      cell: (o) => (
        <Link
          href={`/admin/orders/${o.id}`}
          className="font-medium text-brand-600 hover:underline"
        >
          {o.orderNumber}
        </Link>
      ),
    },
    { key: "user", header: "ユーザー", cell: (o) => o.user.email },
    {
      key: "total",
      header: "金額",
      align: "right",
      cell: (o) => formatYen(o.total),
    },
    {
      key: "status",
      header: "状態",
      cell: (o) => <StatusBadge kind="order" status={o.status} />,
    },
    {
      key: "createdAt",
      header: "日時",
      cell: (o) => formatDateTime(o.createdAt),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          label="累計売上（支払済）"
          value={formatYen(sales._sum.total ?? 0)}
          icon="💰"
          tone="green"
        />
        <DashboardCard
          label="支払済 注文数"
          value={paidCount}
          icon="🧾"
          tone="blue"
        />
        <DashboardCard
          label="販売中イベント"
          value={onSaleEvents}
          icon="🎫"
          tone="brand"
        />
        <DashboardCard
          label="未処理（発送・決済）"
          value={unfulfilled + pendingCount}
          sub={`未発送 ${unfulfilled} / 未決済 ${pendingCount}`}
          icon="⚠️"
          tone="amber"
        />
      </div>

      {pendingCount > 0 && (
        <Alert tone="warning" title="未決済の注文があります">
          {pendingCount} 件の注文が決済待ちです。仮確保期限を過ぎたものは自動解放されます。
        </Alert>
      )}

      <Card>
        <CardHeader title="最近の注文" />
        <CardBody>
          <DataTable columns={columns} rows={recent} />
        </CardBody>
      </Card>
    </div>
  );
}
