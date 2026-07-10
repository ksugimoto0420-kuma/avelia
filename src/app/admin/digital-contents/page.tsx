import type { Prisma } from "@prisma/client";
import Link from "next/link";
import {
  FilterBar,
  FilterField,
  FilterSelect,
  FilterText,
} from "@/components/admin/Filters";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const TYPE_LABEL: Record<string, string> = {
  IMAGE: "画像",
  FILE: "ファイル",
};

const DELIVERY_LABEL: Record<string, string> = {
  SHARED: "共通配信",
  PERSONALIZED: "個別サイン",
};

export default async function AdminDigitalContentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const type = sp.type ?? "";
  const deliveryType = sp.deliveryType ?? "";
  const page = Math.max(1, Number(sp.page ?? "1"));

  const where: Prisma.DigitalContentWhereInput = {};
  if (type) where.type = type as Prisma.DigitalContentWhereInput["type"];
  if (deliveryType)
    where.deliveryType =
      deliveryType as Prisma.DigitalContentWhereInput["deliveryType"];
  if (q)
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { product: { name: { contains: q, mode: "insensitive" } } },
    ];

  const [contents, total] = await Promise.all([
    prisma.digitalContent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        product: { select: { name: true } },
        _count: { select: { userGrants: true } },
      },
    }),
    prisma.digitalContent.count({ where }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  type Row = (typeof contents)[number];
  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "タイトル",
      cell: (c) => (
        <Link
          href={`/admin/digital-contents/${c.id}`}
          className="font-medium text-brand-600 hover:underline"
        >
          {c.title}
        </Link>
      ),
    },
    {
      key: "type",
      header: "種別",
      cell: (c) => <Badge color="purple">{TYPE_LABEL[c.type]}</Badge>,
    },
    {
      key: "deliveryType",
      header: "配信",
      cell: (c) => (
        <Badge color={c.deliveryType === "PERSONALIZED" ? "pink" : "blue"}>
          {DELIVERY_LABEL[c.deliveryType]}
        </Badge>
      ),
    },
    { key: "product", header: "紐づけ商品", cell: (c) => c.product?.name ?? "-" },
    {
      key: "grants",
      header: "付与数",
      align: "right",
      cell: (c) => c._count.userGrants,
    },
    {
      key: "limit",
      header: "制限",
      cell: (c) =>
        [
          c.viewLimitDays ? `${c.viewLimitDays}日` : null,
          c.downloadLimit ? `DL${c.downloadLimit}回` : null,
        ]
          .filter(Boolean)
          .join(" / ") || "なし",
    },
    {
      key: "createdAt",
      header: "登録日",
      cell: (c) => formatDateTime(c.createdAt),
    },
  ];

  const qs = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q, type, deliveryType, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/digital-contents?${s}` : "/admin/digital-contents";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          デジタルコンテンツ管理
        </h1>
        <Button href="/admin/digital-contents/new">＋ 新規登録</Button>
      </div>

      <FilterBar
        action="/admin/digital-contents"
        clearHref="/admin/digital-contents"
      >
        <FilterField label="キーワード">
          <FilterText
            name="q"
            defaultValue={q}
            placeholder="タイトル・商品名"
          />
        </FilterField>
        <FilterField label="種別">
          <FilterSelect
            name="type"
            defaultValue={type}
            className="w-32"
            options={[
              { value: "", label: "すべて" },
              { value: "IMAGE", label: TYPE_LABEL.IMAGE },
              { value: "FILE", label: TYPE_LABEL.FILE },
            ]}
          />
        </FilterField>
        <FilterField label="配信方式">
          <FilterSelect
            name="deliveryType"
            defaultValue={deliveryType}
            className="w-40"
            options={[
              { value: "", label: "すべて" },
              // Phase 1 では SHARED は非表示。Phase 2 で復活予定。
              // { value: "SHARED", label: DELIVERY_LABEL.SHARED },
              { value: "PERSONALIZED", label: DELIVERY_LABEL.PERSONALIZED },
            ]}
          />
        </FilterField>
      </FilterBar>

      <Card>
        <CardBody className="space-y-4">
          <p className="text-sm text-gray-500">
            {total} 件中 {contents.length} 件を表示
          </p>
          <DataTable
            columns={columns}
            rows={contents}
            emptyMessage="該当するコンテンツがありません"
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
