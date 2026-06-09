import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FilterBar, FilterField, FilterSelect, FilterText } from "@/components/admin/Filters";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { DeliveryUploadRow } from "./DeliveryUploadRow";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminDigitalDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminPage("OPERATOR");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status ?? "PENDING";
  const eventId = sp.eventId ?? "";
  const page = Math.max(1, Number(sp.page ?? "1"));

  const where: Prisma.DigitalDeliveryWhereInput = {};
  if (status === "PENDING" || status === "READY") where.status = status;
  if (eventId) where.digitalContent = { product: { eventId } };
  if (q)
    where.OR = [
      { nickname: { contains: q, mode: "insensitive" } },
      { order: { orderNumber: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];

  const [deliveries, total, events, pendingCount] = await Promise.all([
    prisma.digitalDelivery.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        order: { select: { orderNumber: true } },
        user: { select: { email: true } },
        orderItem: { select: { productName: true, variantName: true, quantity: true } },
        digitalContent: { select: { title: true, baseImageKey: true } },
      },
    }),
    prisma.digitalDelivery.count({ where }),
    prisma.event.findMany({
      where: { products: { some: { type: "DIGITAL" } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    prisma.digitalDelivery.count({ where: { status: "PENDING" } }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildHref = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q, status, eventId, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/admin/digital-deliveries?${qs}` : "/admin/digital-deliveries";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">サイン納品</h1>
        <Badge color={pendingCount > 0 ? "yellow" : "green"}>
          制作待ち {pendingCount} 件
        </Badge>
      </div>
      <p className="text-sm text-gray-500">
        各行の宛名でサイン画像を制作し、<b>その行にアップロード</b>すると購入者へ自動通知され、マイページからダウンロード可能になります。
      </p>

      <FilterBar action="/admin/digital-deliveries" clearHref="/admin/digital-deliveries">
        <FilterField label="状態">
          <FilterSelect
            name="status"
            defaultValue={status}
            className="w-32"
            options={[
              { value: "PENDING", label: "制作待ち" },
              { value: "READY", label: "納品済" },
              { value: "all", label: "すべて" },
            ]}
          />
        </FilterField>
        <FilterField label="イベント">
          <FilterSelect
            name="eventId"
            defaultValue={eventId}
            className="w-56"
            options={[
              { value: "", label: "すべて" },
              ...events.map((e) => ({ value: e.id, label: e.title })),
            ]}
          />
        </FilterField>
        <FilterField label="キーワード">
          <FilterText name="q" defaultValue={q} placeholder="注文番号・メール・宛名" />
        </FilterField>
      </FilterBar>

      <Card>
        <CardBody className="space-y-4">
          <p className="text-sm text-gray-500">{total} 件中 {deliveries.length} 件を表示</p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 text-left">注文 / 購入者</th>
                  <th className="px-4 py-3 text-left">商品</th>
                  <th className="px-4 py-3 text-left">宛名</th>
                  <th className="px-4 py-3 text-left">ファイル名(推奨)</th>
                  <th className="px-4 py-3 text-left">状態</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                      該当する納品がありません
                    </td>
                  </tr>
                ) : (
                  deliveries.map((d) => {
                    const suggestedName = `${d.order.orderNumber}_${d.nickname ?? "宛名なし"}_${d.unitIndex + 1}`;
                    return (
                      <tr key={d.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/orders/${d.orderId}`}
                            className="font-medium text-brand-600 hover:underline"
                          >
                            {d.order.orderNumber}
                          </Link>
                          <p className="text-xs text-gray-400">{d.user.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-900">{d.digitalContent.title}</p>
                          <p className="text-xs text-gray-400">
                            {d.orderItem.productName}（{d.orderItem.variantName}）
                            {d.orderItem.quantity >= 2 &&
                              ` ${d.unitIndex + 1}/${d.orderItem.quantity}個目`}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-900">
                            {d.nickname ?? "—"}
                          </span>
                          {d.nicknameKana && (
                            <span className="text-xs text-gray-400">
                              （{d.nicknameKana}）
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs text-gray-500">
                            {suggestedName}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge kind="delivery" status={d.status} />
                          {d.deliveredAt && (
                            <p className="mt-0.5 text-xs text-gray-400">
                              {formatDateTime(d.deliveredAt)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {d.digitalContent.baseImageKey ? (
                              <a
                                href={`/api/admin/deliveries/base-image/${encodeURIComponent(d.digitalContent.baseImageKey)}`}
                                className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                              >
                                原本DL
                              </a>
                            ) : (
                              <span className="text-xs text-amber-600">原本未登録</span>
                            )}
                            <DeliveryUploadRow
                              deliveryId={d.id}
                              isReady={d.status === "READY"}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => buildHref({ page: String(p) })} />
        </CardBody>
      </Card>
    </div>
  );
}
