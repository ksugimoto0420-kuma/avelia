import type { Prisma } from "@prisma/client";
import {
  FilterBar,
  FilterField,
  FilterSelect,
  FilterText,
} from "@/components/admin/Filters";
import { Card, CardBody } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminOperationLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminPage("MANAGER");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const actorId = sp.actorId ?? "";
  const targetType = sp.targetType ?? "";
  const page = Math.max(1, Number(sp.page ?? "1"));

  const where: Prisma.OperationLogWhereInput = {};
  if (actorId) where.adminUserId = actorId;
  if (targetType) where.targetType = targetType;
  if (q)
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { targetType: { contains: q, mode: "insensitive" } },
      { targetId: { contains: q, mode: "insensitive" } },
    ];

  const [logs, total, admins, targetTypes] = await Promise.all([
    prisma.operationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { adminUser: { select: { name: true, email: true } } },
    }),
    prisma.operationLog.count({ where }),
    prisma.adminUser.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.operationLog.findMany({
      where: { targetType: { not: null } },
      distinct: ["targetType"],
      select: { targetType: true },
      take: 50,
    }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const qs = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q, actorId, targetType, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/operation-logs?${s}` : "/admin/operation-logs";
  };

  type Row = (typeof logs)[number];
  const columns: Column<Row>[] = [
    {
      key: "createdAt",
      header: "日時",
      cell: (l) => formatDateTime(l.createdAt),
    },
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">操作ログ</h1>
        <p className="text-sm text-gray-500">
          管理者操作の監査ログです（仕様書 15. セキュリティ要件）。
        </p>
      </div>

      <FilterBar
        action="/admin/operation-logs"
        clearHref="/admin/operation-logs"
      >
        <FilterField label="キーワード">
          <FilterText
            name="q"
            defaultValue={q}
            placeholder="操作・対象タイプ・対象ID"
          />
        </FilterField>
        <FilterField label="操作者">
          <FilterSelect
            name="actorId"
            defaultValue={actorId}
            className="w-48"
            options={[
              { value: "", label: "すべて" },
              ...admins.map((a) => ({
                value: a.id,
                label: a.name ? `${a.name} (${a.email})` : a.email,
              })),
            ]}
          />
        </FilterField>
        <FilterField label="対象タイプ">
          <FilterSelect
            name="targetType"
            defaultValue={targetType}
            className="w-44"
            options={[
              { value: "", label: "すべて" },
              ...targetTypes
                .map((t) => t.targetType)
                .filter((t): t is string => !!t)
                .map((t) => ({ value: t, label: t })),
            ]}
          />
        </FilterField>
      </FilterBar>

      <Card>
        <CardBody className="space-y-4">
          <p className="text-sm text-gray-500">
            {total} 件中 {logs.length} 件を表示
          </p>
          <DataTable
            columns={columns}
            rows={logs}
            emptyMessage="該当するログがありません"
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
