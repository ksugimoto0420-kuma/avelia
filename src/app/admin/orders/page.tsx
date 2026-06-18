import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/lib/utils";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const STATUSES = ["", "PENDING", "PAID", "CANCELLED", "REFUNDED", "FAILED"];
const STATUS_LABEL: Record<string, string> = {
  "": "すべて",
  PENDING: "未決済",
  PAID: "支払済",
  CANCELLED: "キャンセル",
  REFUNDED: "返金済",
  FAILED: "失敗",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
    month?: string;
  }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const status = sp.status ?? "";
  const q = sp.q ?? "";
  // 年月絞り込み: "YYYY-MM" 形式。空欄なら絞らない。
  const month = sp.month ?? "";
  const page = Math.max(1, Number(sp.page ?? "1"));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    where.createdAt = { gte: start, lt: end };
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { email: true } },
        payment: true,
        shipment: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  type Row = (typeof orders)[number];
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
    { key: "total", header: "金額", align: "right", cell: (o) => formatYen(o.total) },
    {
      key: "status",
      header: "注文",
      cell: (o) => <StatusBadge kind="order" status={o.status} />,
    },
    {
      key: "payment",
      header: "決済",
      cell: (o) =>
        o.payment ? <StatusBadge kind="payment" status={o.payment.status} /> : "-",
    },
    {
      key: "shipment",
      header: "発送",
      cell: (o) =>
        o.shipment ? (
          <StatusBadge kind="shipment" status={o.shipment.status} />
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    { key: "createdAt", header: "日時", cell: (o) => formatDateTime(o.createdAt) },
  ];

  const qs = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    if (month) p.set("month", month);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `/admin/orders?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">注文管理</h1>
        <Button href="/api/admin/exports/orders" variant="outline" size="sm">
          CSV出力
        </Button>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((s) => (
              <Link
                key={s || "all"}
                href={qs({ status: s, page: "" })}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  s === status
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",
                )}
              >
                {STATUS_LABEL[s]}
              </Link>
            ))}
            <form
              className="ml-auto flex flex-wrap items-center gap-2"
              action="/admin/orders"
              method="get"
            >
              {status && <input type="hidden" name="status" value={status} />}
              <label
                htmlFor="orders-month"
                className="text-xs font-medium text-gray-600"
              >
                注文年月
              </label>
              <input
                id="orders-month"
                type="month"
                name="month"
                defaultValue={month}
                placeholder="例: 2026-06"
                pattern="\d{4}-(0[1-9]|1[0-2])"
                title="YYYY-MM 形式（例: 2026-06）"
                className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="注文番号・メール検索"
                className="w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </form>
          </div>

          <DataTable columns={columns} rows={orders} emptyMessage="注文がありません" />

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
