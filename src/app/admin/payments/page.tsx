import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card, CardBody } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { currentJstPeriod, formatDateTime, formatYen } from "@/lib/utils";
import { PaymentsFilterControls } from "./PaymentsFilterControls";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status ?? "";
  // 支払い年月: "YYYY-MM" / "all" / 未指定 のいずれか。paidAt で絞る。
  const rawMonth = sp.month ?? "";
  const month = rawMonth === "all" ? "" : rawMonth;
  const defaultMonth = currentJstPeriod();
  const page = Math.max(1, Number(sp.page ?? "1"));

  const where: Prisma.PaymentWhereInput = {};
  if (status) where.status = status as Prisma.PaymentWhereInput["status"];
  if (q)
    where.OR = [
      { providerPaymentId: { contains: q, mode: "insensitive" } },
      { providerSessionId: { contains: q, mode: "insensitive" } },
      { order: { orderNumber: { contains: q, mode: "insensitive" } } },
      { order: { user: { email: { contains: q, mode: "insensitive" } } } },
    ];
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    // 「年月」絞り込みは決済レコードの createdAt 基準。PENDING/AUTHORIZED/
    // FAILED は paidAt が立たないため createdAt で揃えると見落としが無い。
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    where.createdAt = { gte: start, lt: end };
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        order: { include: { user: { select: { email: true } } } },
      },
    }),
    prisma.payment.count({ where }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const qs = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q, status, month: rawMonth, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/payments?${s}` : "/admin/payments";
  };

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
    {
      key: "paidAt",
      header: "支払日時",
      cell: (p) => formatDateTime(p.paidAt),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">決済管理</h1>
        <p className="text-sm text-gray-500">
          カード番号は保持していません。外部決済IDのみ記録しています。
        </p>
      </div>

      <PaymentsFilterControls
        defaultMonth={defaultMonth}
        currentMonth={rawMonth}
        currentStatus={status}
        currentQ={q}
      />

      <Card>
        <CardBody className="space-y-4">
          <p className="text-sm text-gray-500">
            {total} 件中 {payments.length} 件を表示
          </p>
          <DataTable
            columns={columns}
            rows={payments}
            emptyMessage="該当する決済がありません"
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(p) => qs({ page: String(p) })}
          />
        </CardBody>
      </Card>
    </div>
  );
}
