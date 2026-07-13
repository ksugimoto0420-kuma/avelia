import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { cn, currentJstPeriod } from "@/lib/utils";
import { OrdersBulkTable, type OrderRow } from "./OrdersBulkTable";
import { OrdersFilterControls } from "./OrdersFilterControls";

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
    eventId?: string;
  }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const status = sp.status ?? "";
  const q = sp.q ?? "";
  // 注文年月: "YYYY-MM" 形式。"all" や空欄なら絞り込まない。
  // URL に month が無い場合（初回訪問）は JS 側で現在年月を埋めて遷移する。
  const rawMonth = sp.month ?? "";
  const month = rawMonth === "all" ? "" : rawMonth;
  const defaultMonth = currentJstPeriod();
  // #4: イベント別絞り込み。仕様書 3-1 に従い OrderItem→Variant→Product.eventId
  // 経由で「注文にそのイベントの商品が1つでも含まれていれば表示」の条件を組む。
  const eventId = sp.eventId ?? "";
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
  if (eventId) {
    where.items = { some: { variant: { product: { eventId } } } };
  }

  const [orders, total, events] = await Promise.all([
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
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, artistName: true },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    userEmail: o.user.email,
    total: o.total,
    status: o.status,
    paymentStatus: o.payment?.status ?? null,
    shipmentStatus: o.shipment?.status ?? null,
    createdAt: o.createdAt.toISOString(),
  }));

  const qs = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    if (month) p.set("month", month);
    if (eventId) p.set("eventId", eventId);
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
            <OrdersFilterControls
              defaultMonth={defaultMonth}
              currentMonth={rawMonth}
              currentQ={q}
              currentEventId={eventId}
              events={events.map((e) => ({
                id: e.id,
                label: e.artistName ? `${e.artistName} / ${e.title}` : e.title,
              }))}
            />
          </div>

          <OrdersBulkTable rows={rows} />

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
