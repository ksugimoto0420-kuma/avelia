import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { FilterBar, FilterField, FilterSelect, FilterText } from "@/components/admin/Filters";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdminPage } from "@/lib/auth/admin-page";
import {
  EVENT_TYPE_COLOR,
  EVENT_TYPE_LABEL,
  SALE_METHOD_COLOR,
  SALE_METHOD_LABEL,
} from "@/lib/event-meta";
import { prisma } from "@/lib/prisma";
import {
  getSaleStatus,
  SALE_STATUS_COLOR,
  SALE_STATUS_LABEL,
} from "@/lib/sale";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const type = sp.type ?? "";
  const method = sp.method ?? "";
  const published = sp.published ?? "";
  const status = sp.status ?? "";
  const page = Math.max(1, Number(sp.page ?? "1"));
  const now = new Date();

  const where: Prisma.EventWhereInput = {};
  if (q)
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { artistName: { contains: q, mode: "insensitive" } },
    ];
  if (type) where.eventType = type as Prisma.EventWhereInput["eventType"];
  if (method) where.saleMethod = method as Prisma.EventWhereInput["saleMethod"];
  if (published === "published") where.isPublished = true;
  if (published === "draft") where.isPublished = false;
  if (status === "on_sale") {
    where.AND = [
      { OR: [{ saleStartAt: null }, { saleStartAt: { lte: now } }] },
      { OR: [{ saleEndAt: null }, { saleEndAt: { gte: now } }] },
    ];
  } else if (status === "upcoming") {
    where.saleStartAt = { gt: now };
  } else if (status === "ended") {
    where.saleEndAt = { lt: now };
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { products: true } } },
    }),
    prisma.event.count({ where }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildHref = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q, type, method, published, status, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/admin/events?${qs}` : "/admin/events";
  };

  type Row = (typeof events)[number];
  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "イベント",
      cell: (e) => (
        <div>
          <Link
            href={`/admin/events/${e.id}`}
            className="font-medium text-brand-600 hover:underline"
          >
            {e.title}
          </Link>
          {e.artistName && (
            <p className="text-xs text-gray-400">{e.artistName}</p>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "種別 / 方式",
      cell: (e) => (
        <div className="flex flex-wrap gap-1">
          <Badge color={EVENT_TYPE_COLOR[e.eventType]}>
            {EVENT_TYPE_LABEL[e.eventType]}
          </Badge>
          <Badge color={SALE_METHOD_COLOR[e.saleMethod]}>
            {SALE_METHOD_LABEL[e.saleMethod]}
          </Badge>
        </div>
      ),
    },
    {
      key: "status",
      header: "販売状態",
      cell: (e) => {
        const s = getSaleStatus({
          isPublished: e.isPublished,
          saleStartAt: e.saleStartAt,
          saleEndAt: e.saleEndAt,
        });
        return <Badge color={SALE_STATUS_COLOR[s]}>{SALE_STATUS_LABEL[s]}</Badge>;
      },
    },
    {
      key: "published",
      header: "公開",
      cell: (e) =>
        e.isPublished ? (
          <Badge color="green">公開中</Badge>
        ) : (
          <Badge color="gray">非公開</Badge>
        ),
    },
    {
      key: "products",
      header: "商品数",
      align: "right",
      cell: (e) => e._count.products,
    },
    {
      key: "end",
      header: "販売終了",
      cell: (e) => formatDateTime(e.saleEndAt),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">イベント管理</h1>
        <Button href="/admin/events/new">＋ 新規イベント</Button>
      </div>

      <FilterBar action="/admin/events" clearHref="/admin/events">
        <FilterField label="キーワード">
          <FilterText name="q" defaultValue={q} placeholder="タイトル・出演者" />
        </FilterField>
        <FilterField label="種別">
          <FilterSelect
            name="type"
            defaultValue={type}
            options={[
              { value: "", label: "すべて" },
              { value: "MEET_GREET", label: EVENT_TYPE_LABEL.MEET_GREET },
              // Phase 1 では非表示。Phase 2 で復活予定。
              // { value: "KUJI", label: EVENT_TYPE_LABEL.KUJI },
              // { value: "TRADING_CARD", label: EVENT_TYPE_LABEL.TRADING_CARD },
              // { value: "GOODS", label: EVENT_TYPE_LABEL.GOODS },
            ]}
          />
        </FilterField>
        <FilterField label="販売方式">
          <FilterSelect
            name="method"
            defaultValue={method}
            className="w-28"
            options={[
              { value: "", label: "すべて" },
              { value: "FIRST_COME", label: "先着" },
              { value: "LOTTERY", label: "抽選" },
            ]}
          />
        </FilterField>
        <FilterField label="販売状態">
          <FilterSelect
            name="status"
            defaultValue={status}
            className="w-32"
            options={[
              { value: "", label: "すべて" },
              { value: "on_sale", label: "販売中" },
              { value: "upcoming", label: "販売予定" },
              { value: "ended", label: "終了" },
            ]}
          />
        </FilterField>
        <FilterField label="公開">
          <FilterSelect
            name="published"
            defaultValue={published}
            className="w-28"
            options={[
              { value: "", label: "すべて" },
              { value: "published", label: "公開中" },
              { value: "draft", label: "非公開" },
            ]}
          />
        </FilterField>
      </FilterBar>

      <Card>
        <CardBody className="space-y-4">
          <p className="text-sm text-gray-500">{total} 件中 {events.length} 件を表示</p>
          <DataTable
            columns={columns}
            rows={events}
            emptyMessage="該当するイベントがありません"
          />
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => buildHref({ page: String(p) })} />
        </CardBody>
      </Card>
    </div>
  );
}
