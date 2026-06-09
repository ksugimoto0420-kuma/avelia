import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card, CardBody } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  await requireAdminPage();

  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { order: { include: { user: { select: { email: true } } } } },
  });

  type Row = (typeof payments)[number];
  const columns: Column<Row>[] = [
    {
      key: "order",
      header: "注文番号",
      cell: (p) => (
        <Link
          href={`/admin/orders/${p.orderId}`}
          className="font-medium text-brand-600 hover:underline"
        >
          {p.order.orderNumber}
        </Link>
      ),
    },
    { key: "user", header: "ユーザー", cell: (p) => p.order.user.email },
    { key: "provider", header: "プロバイダ", cell: (p) => p.provider },
    {
      key: "amount",
      header: "金額",
      align: "right",
      cell: (p) => formatYen(p.amount),
    },
    {
      key: "status",
      header: "状態",
      cell: (p) => <StatusBadge kind="payment" status={p.status} />,
    },
    {
      key: "providerPaymentId",
      header: "外部決済ID",
      cell: (p) => (
        <span className="break-all text-xs text-gray-400">
          {p.providerPaymentId ?? "-"}
        </span>
      ),
    },
    { key: "paidAt", header: "支払日時", cell: (p) => formatDateTime(p.paidAt) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">決済管理</h1>
      <p className="text-sm text-gray-500">
        カード番号は保持していません。外部決済IDのみ記録しています。
      </p>
      <Card>
        <CardBody>
          <DataTable columns={columns} rows={payments} emptyMessage="決済がありません" />
        </CardBody>
      </Card>
    </div>
  );
}
