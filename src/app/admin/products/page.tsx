import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { FilterBar, FilterField, FilterSelect, FilterText } from "@/components/admin/Filters";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { SearchableSelectField } from "@/components/ui/SearchableSelectField";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { EVENT_TYPE_LABEL } from "@/lib/event-meta";
import { availableStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const eventId = sp.eventId ?? "";
  const type = sp.type ?? "";
  const eventType = sp.eventType ?? "";
  const published = sp.published ?? "";
  const page = Math.max(1, Number(sp.page ?? "1"));

  const where: Prisma.ProductWhereInput = {};
  if (q) where.name = { contains: q, mode: "insensitive" };
  if (eventId) where.eventId = eventId;
  if (type) where.type = type as Prisma.ProductWhereInput["type"];
  if (published === "published") where.isPublished = true;
  if (published === "draft") where.isPublished = false;
  if (eventType)
    where.event = { eventType: eventType as Prisma.EventWhereInput["eventType"] };

  const [products, total, events] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        event: { select: { title: true } },
        variants: { include: { inventory: true } },
      },
    }),
    prisma.product.count({ where }),
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildHref = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q, eventId, type, eventType, published, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  };

  type Row = (typeof products)[number];
  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "商品",
      cell: (p) => (
        <Link
          href={`/admin/products/${p.id}`}
          className="font-medium text-brand-600 hover:underline"
        >
          {p.name}
        </Link>
      ),
    },
    { key: "event", header: "イベント", cell: (p) => p.event.title },
    {
      key: "type",
      header: "区分",
      cell: (p) =>
        p.type === "DIGITAL" ? (
          <Badge color="purple">デジタル</Badge>
        ) : (
          <Badge color="blue">物販</Badge>
        ),
    },
    { key: "price", header: "価格", align: "right", cell: (p) => formatYen(p.basePrice) },
    {
      key: "stock",
      header: "在庫(残)",
      align: "right",
      cell: (p) => {
        const avail = p.variants.reduce(
          (s, v) => s + (v.inventory ? availableStock(v.inventory) : 0),
          0,
        );
        return (
          <span className={avail <= 5 ? "font-bold text-red-600" : ""}>{avail}</span>
        );
      },
    },
    {
      key: "published",
      header: "公開",
      cell: (p) =>
        p.isPublished ? (
          <Badge color="green">公開中</Badge>
        ) : (
          <Badge color="gray">非公開</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* header: スマホでは縦積み、sm 以上で横並び */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">商品管理</h1>
        <Button href="/admin/products/new">＋ 新規商品</Button>
      </div>

      <FilterBar action="/admin/products" clearHref="/admin/products">
        <FilterField label="キーワード">
          <FilterText
            name="q"
            defaultValue={q}
            placeholder="商品名"
            className="w-full sm:w-56"
          />
        </FilterField>
        <FilterField label="イベント">
          <div className="w-full sm:w-64">
            <SearchableSelectField
              name="eventId"
              defaultValue={eventId}
              allowEmpty
              emptyLabel="すべて"
              emptyValue=""
              placeholder="イベントを選択"
              searchPlaceholder="イベント名で検索…"
              options={events.map((e) => ({ value: e.id, label: e.title }))}
            />
          </div>
        </FilterField>
        <FilterField label="種別">
          <FilterSelect
            name="eventType"
            defaultValue={eventType}
            className="w-full sm:w-40"
            options={[
              { value: "", label: "すべて" },
              { value: "MEET_GREET", label: EVENT_TYPE_LABEL.MEET_GREET },
              { value: "KUJI", label: EVENT_TYPE_LABEL.KUJI },
              { value: "TRADING_CARD", label: EVENT_TYPE_LABEL.TRADING_CARD },
              { value: "GOODS", label: EVENT_TYPE_LABEL.GOODS },
            ]}
          />
        </FilterField>
        <FilterField label="区分">
          <FilterSelect
            name="type"
            defaultValue={type}
            className="w-full sm:w-28"
            options={[
              { value: "", label: "すべて" },
              { value: "PHYSICAL", label: "物販" },
              { value: "DIGITAL", label: "デジタル" },
            ]}
          />
        </FilterField>
        <FilterField label="公開">
          <FilterSelect
            name="published"
            defaultValue={published}
            className="w-full sm:w-28"
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
          <p className="text-sm text-gray-500">
            {total} 件中 {products.length} 件を表示
          </p>

          {/* sm 以上: 従来のテーブル表示 */}
          <div className="hidden sm:block">
            <DataTable
              columns={columns}
              rows={products}
              emptyMessage="該当する商品がありません"
            />
          </div>

          {/* sm 未満: カードスタック表示 (タップしやすい大きめのタッチ領域) */}
          <div className="space-y-2 sm:hidden">
            {products.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
                該当する商品がありません
              </p>
            ) : (
              products.map((p) => {
                const avail = p.variants.reduce(
                  (s, v) =>
                    s + (v.inventory ? availableStock(v.inventory) : 0),
                  0,
                );
                return (
                  <Link
                    key={p.id}
                    href={`/admin/products/${p.id}`}
                    className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 break-words font-semibold text-brand-600">
                        {p.name}
                      </p>
                      {p.isPublished ? (
                        <Badge color="green">公開中</Badge>
                      ) : (
                        <Badge color="gray">非公開</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {p.event.title}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      {p.type === "DIGITAL" ? (
                        <Badge color="purple">デジタル</Badge>
                      ) : (
                        <Badge color="blue">物販</Badge>
                      )}
                      <span className="font-bold text-gray-900">
                        {formatYen(p.basePrice)}
                      </span>
                      <span
                        className={
                          avail <= 5
                            ? "font-bold text-red-600"
                            : "text-gray-500"
                        }
                      >
                        在庫 {avail}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(p) => buildHref({ page: String(p) })}
          />
        </CardBody>
      </Card>
    </div>
  );
}
