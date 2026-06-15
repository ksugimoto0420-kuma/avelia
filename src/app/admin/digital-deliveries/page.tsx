import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FilterBar, FilterField, FilterSelect, FilterText } from "@/components/admin/Filters";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { approveSignature, rejectSignature } from "./actions";
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
        signature: { select: { id: true, status: true, writtenAt: true } },
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">サイン納品</h1>
        <div className="flex items-center gap-2">
          <Badge color={pendingCount > 0 ? "yellow" : "green"}>
            制作待ち {pendingCount} 件
          </Badge>
          <Button href="/admin/sign-session" size="sm">
            ✍ サイン記入セッション
          </Button>
        </div>
      </div>
      <p className="text-sm text-gray-500">
        出演者がタブレットで直接サインを書く <b>「サイン記入セッション」</b> を使うか、
        従来通り <b>サイン入りファイルをアップロード</b> してください。 サイン記入セッションのサインは、運営側で確認・承認すると購入者に納品されます。
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
                          {d.signature?.status === "WRITTEN" && (
                            <span className="ml-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                              サイン記入済み
                            </span>
                          )}
                          {d.signature?.status === "REJECTED" && (
                            <span className="ml-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              書き直し依頼中
                            </span>
                          )}
                          {d.deliveredAt && (
                            <p className="mt-0.5 text-xs text-gray-400">
                              {formatDateTime(d.deliveredAt)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-end gap-2">
                            {/* サイン記入セッションで書かれている場合：プレビュー＋承認/却下 */}
                            {d.signature?.status === "WRITTEN" && (
                              <div className="flex items-end gap-2">
                                <a
                                  href={`/api/admin/signatures/${d.signature.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block h-14 w-20 overflow-hidden rounded border border-gray-200 bg-white"
                                  title="クリックで拡大表示"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={`/api/admin/signatures/${d.signature.id}`}
                                    alt="サインプレビュー"
                                    className="h-full w-full object-contain"
                                  />
                                </a>
                                <div className="flex flex-col gap-1">
                                  <form action={approveSignature}>
                                    <input type="hidden" name="deliveryId" value={d.id} />
                                    <button
                                      type="submit"
                                      className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                                    >
                                      承認して納品
                                    </button>
                                  </form>
                                  <form action={rejectSignature}>
                                    <input type="hidden" name="deliveryId" value={d.id} />
                                    <button
                                      type="submit"
                                      className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                                    >
                                      書き直し
                                    </button>
                                  </form>
                                </div>
                              </div>
                            )}
                            {/* 既存：原本DL + ファイルアップロード（手動納品） */}
                            <div className="flex items-center gap-2">
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
