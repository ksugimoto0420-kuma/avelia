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

type LowStockRow = {
  variantId: string;
  variantName: string;
  productName: string;
  eventTitle: string;
  available: number;
  lowStockThreshold: number;
};

export default async function AdminDashboard() {
  await requireAdminPage();
  const now = new Date();

  const [
    sales,
    paidCount,
    pendingCount,
    onSaleEvents,
    unfulfilled,
    recent,
    lowStock,
  ] = await Promise.all([
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
      // 低在庫アラート:
      //   閾値設定済み・利用可能在庫 ≤ 閾値・販売可能状態のみ
      // 「販売可能」= 商品とイベントが公開中、かつイベント saleEndAt 未経過
      //   非公開や販売終了済みのSKUは買えないのでアラート対象から除外する。
      //   ここの条件は在庫管理画面の visibility=public フィルタと同条件にして
      //   ダッシュボードと在庫一覧の件数が一致するよう揃えている。
      prisma.$queryRaw<LowStockRow[]>`
        SELECT pv.id AS "variantId", pv.name AS "variantName",
               p.name AS "productName", e.title AS "eventTitle",
               (i.quantity - i.reserved - i.sold)::int AS available,
               i."lowStockThreshold" AS "lowStockThreshold"
        FROM inventories i
        JOIN product_variants pv ON pv.id = i."variantId"
        JOIN products p ON p.id = pv."productId"
        JOIN events e ON e.id = p."eventId"
        WHERE i."lowStockThreshold" IS NOT NULL
          AND (i.quantity - i.reserved - i.sold) <= i."lowStockThreshold"
          AND p."isPublished" = true
          AND e."isPublished" = true
          AND (e."saleEndAt" IS NULL OR e."saleEndAt" >= NOW())
        ORDER BY (i.quantity - i.reserved - i.sold) ASC, p.name ASC
        LIMIT 8
      `,
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <DashboardCard
          label="低在庫アラート"
          value={lowStock.length}
          sub="閾値以下のSKU数"
          icon="📦"
          tone="red"
        />
      </div>

      {pendingCount > 0 && (
        <Alert tone="warning" title="未決済の注文があります">
          {pendingCount} 件の注文が決済待ちです。仮確保期限を過ぎたものは自動解放されます。
        </Alert>
      )}

      {lowStock.length > 0 && (
        <Card>
          <CardHeader
            title="低在庫アラート"
            subtitle="閾値以下の SKU（公開中のみ表示）"
            action={
              <Link
                href="/admin/inventories?stock=below_threshold&visibility=public"
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                在庫管理へ →
              </Link>
            }
          />
          <CardBody className="px-0 py-0">
            <ul className="divide-y divide-gray-100">
              {lowStock.map((r) => (
                <li
                  key={r.variantId}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/inventories/${r.variantId}`}
                      className="block truncate font-medium text-gray-900 hover:text-brand-600"
                    >
                      {r.productName}（{r.variantName}）
                    </Link>
                    <p className="truncate text-xs text-gray-500">
                      {r.eventTitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold " +
                        (r.available <= 0
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700")
                      }
                    >
                      残 {r.available}
                    </span>
                    <span className="text-xs text-gray-400">
                      閾値 {r.lowStockThreshold}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
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
