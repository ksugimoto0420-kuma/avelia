import type { Prisma } from "@prisma/client";
import Link from "next/link";
import {
  FilterBar,
  FilterField,
  FilterSelect,
  FilterText,
} from "@/components/admin/Filters";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card, CardBody } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";

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
  const provider = sp.provider ?? "";
  // 支払い年月 (YYYY-MM)。paidAt で絞る。
  const month = sp.month ?? "";
  const page = Math.max(1, Number(sp.page ?? "1"));

  const where: Prisma.PaymentWhereInput = {};
  if (status) where.status = status as Prisma.PaymentWhereInput["status"];
  if (provider)
    where.provider = provider as Prisma.PaymentWhereInput["provider"];
  if (q)
    where.OR = [
      { providerPaymentId: { contains: q, mode: "insensitive" } },
      { providerSessionId: { contains: q, mode: "insensitive" } },
      { order: { orderNumber: { contains: q, mode: "insensitive" } } },
      { order: { user: { email: { contains: q, mode: "insensitive" } } } },
    ];
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    where.paidAt = { gte: start, lt: end };
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
    const merged = { q, status, provider, month, ...overrides };
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

      <FilterBar action="/admin/payments" clearHref="/admin/payments">
        <FilterField label="キーワード">
          <FilterText
            name="q"
            defaultValue={q}
            placeholder="注文番号・メール・外部決済ID"
          />
        </FilterField>
        <FilterField label="状態">
          <FilterSelect
            name="status"
            defaultValue={status}
            className="w-36"
            options={[
              { value: "", label: "すべて" },
              { value: "PENDING", label: "未決済" },
              { value: "AUTHORIZED", label: "与信済" },
              { value: "PAID", label: "決済完了" },
              { value: "FAILED", label: "失敗" },
              { value: "CANCELLED", label: "キャンセル" },
              { value: "REFUNDED", label: "返金済" },
            ]}
          />
        </FilterField>
        <FilterField label="プロバイダ">
          <FilterSelect
            name="provider"
            defaultValue={provider}
            className="w-32"
            options={[
              { value: "", label: "すべて" },
              { value: "STRIPE", label: "Stripe" },
              { value: "PAYJP", label: "Pay.JP" },
            ]}
          />
        </FilterField>
        <FilterField label="支払年月">
          <input
            type="month"
            name="month"
            defaultValue={month}
            placeholder="例: 2026-06"
            pattern="\d{4}-(0[1-9]|1[0-2])"
            title="YYYY-MM 形式（例: 2026-06）"
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </FilterField>
      </FilterBar>

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
