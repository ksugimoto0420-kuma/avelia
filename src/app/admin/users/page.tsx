import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import {
  FilterBar,
  FilterField,
  FilterText,
} from "@/components/admin/Filters";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdminPage("MANAGER");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page ?? "1"));

  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { nameKana: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        orders: { where: { status: "PAID" }, select: { total: true } },
        _count: {
          select: {
            orders: true,
            lotteryEntries: true,
            digitalContents: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const rows = users.map((u) => {
    const isDeactivated = u.email.endsWith("@deleted.local");
    return {
      id: u.id,
      email: u.email,
      name: u.name ?? "-",
      phone: u.phone ?? "-",
      orderCount: u._count.orders,
      paidTotal: u.orders.reduce((s, o) => s + o.total, 0),
      lotteryCount: u._count.lotteryEntries,
      digitalCount: u._count.digitalContents,
      createdAt: u.createdAt,
      emailVerified: !!u.emailVerified,
      isDeactivated,
    };
  });

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "氏名 / メール",
      cell: (u) => (
        <div>
          <Link
            href={`/admin/users/${u.id}`}
            className="font-medium text-brand-600 hover:underline"
          >
            {u.name}
          </Link>
          <p
            className={
              u.isDeactivated
                ? "text-xs text-gray-400 line-through"
                : "text-xs text-gray-500"
            }
          >
            {u.email}
          </p>
        </div>
      ),
    },
    { key: "phone", header: "電話" },
    {
      key: "status",
      header: "状態",
      cell: (u) =>
        u.isDeactivated ? (
          <Badge color="gray">退会済</Badge>
        ) : u.emailVerified ? (
          <Badge color="green">認証済</Badge>
        ) : (
          <Badge color="yellow">未認証</Badge>
        ),
    },
    { key: "orderCount", header: "注文", align: "right" },
    {
      key: "paidTotal",
      header: "購入金額",
      align: "right",
      cell: (u) => formatYen(u.paidTotal),
    },
    { key: "lotteryCount", header: "応募", align: "right" },
    { key: "createdAt", header: "登録日", cell: (u) => formatDateTime(u.createdAt) },
  ];

  const qs = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return s ? `/admin/users?${s}` : "/admin/users";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
        <p className="text-sm text-gray-500">登録会員 {total} 名</p>
      </div>

      <FilterBar action="/admin/users" clearHref="/admin/users">
        <FilterField label="キーワード">
          <FilterText
            name="q"
            defaultValue={q}
            placeholder="メール・氏名・電話"
          />
        </FilterField>
      </FilterBar>

      <Card>
        <CardBody className="space-y-4">
          <DataTable
            columns={columns}
            rows={rows}
            emptyMessage="該当するユーザーがいません"
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
