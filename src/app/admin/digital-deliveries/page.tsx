import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FilterBar, FilterField, FilterSelect, FilterText } from "@/components/admin/Filters";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { SearchableSelectField } from "@/components/ui/SearchableSelectField";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import {
  approveSignature,
  rejectSignature,
  resendSignatureReadyMail,
} from "./actions";
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
  // #70: メディア種別タブ (all / photo / video)
  const mediaTab = sp.media === "photo" || sp.media === "video" ? sp.media : "all";
  const page = Math.max(1, Number(sp.page ?? "1"));

  const productKindValue =
    mediaTab === "photo"
      ? ("DIGITAL_PHOTO_SIGN" as const)
      : mediaTab === "video"
        ? ("DIGITAL_VIDEO_SIGN" as const)
        : null;

  const where: Prisma.DigitalDeliveryWhereInput = {};
  if (status === "PENDING" || status === "READY") where.status = status;
  // digitalContent.product に対する条件を組み立てる (eventId と productKind を統合)。
  const productWhere: Prisma.ProductWhereInput = {};
  if (eventId) productWhere.eventId = eventId;
  if (productKindValue) productWhere.productKind = productKindValue;
  if (Object.keys(productWhere).length > 0) {
    where.digitalContent = { product: productWhere };
  }
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
        orderItem: {
          select: {
            productName: true,
            variantName: true,
            quantity: true,
            variant: { select: { productId: true } },
          },
        },
        digitalContent: {
          select: {
            title: true,
            baseImageKey: true,
            baseImageUrl: true,
            productId: true,
            product: { select: { productKind: true } },
          },
        },
        signature: { select: { id: true, status: true, writtenAt: true } },
      },
    }),
    prisma.digitalDelivery.count({ where }),
    prisma.event.findMany({
      where: { products: { some: { type: "DIGITAL" } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, artistName: true },
    }),
    prisma.digitalDelivery.count({ where: { status: "PENDING" } }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildHref = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    // media は "all" のときはURLに載せない (デフォルト)
    const mediaParam = mediaTab === "all" ? "" : mediaTab;
    const merged = { q, status, eventId, media: mediaParam, ...overrides };
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

      {/* #70: メディア種別タブ (写真 / 動画) */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: "all" as const, label: "全て" },
          { key: "photo" as const, label: "📷 写真サイン" },
          { key: "video" as const, label: "🎬 動画サイン" },
        ].map((t) => {
          const active = mediaTab === t.key;
          return (
            <Link
              key={t.key}
              href={buildHref({ media: t.key === "all" ? "" : t.key })}
              className={
                "border-b-2 px-4 py-2 text-sm font-medium transition " +
                (active
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-500 hover:text-gray-700")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <FilterBar action="/admin/digital-deliveries" clearHref="/admin/digital-deliveries">
        {/* タブ状態を form 送信でも保持する */}
        {mediaTab !== "all" && (
          <input type="hidden" name="media" value={mediaTab} />
        )}
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
          <div className="w-64">
            <SearchableSelectField
              name="eventId"
              defaultValue={eventId}
              allowEmpty
              emptyLabel="すべて"
              emptyValue=""
              placeholder="イベントを選択"
              searchPlaceholder="アーティスト名やイベント名で検索…"
              options={events.map((e) => ({
                value: e.id,
                label: e.artistName ? `${e.artistName} / ${e.title}` : e.title,
                hint: e.artistName ?? undefined,
              }))}
            />
          </div>
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
                          <div className="flex items-center gap-2">
                            <p className="text-gray-900">{d.digitalContent.title}</p>
                            {/* #70: 写真/動画のメディア種別バッジ */}
                            {d.digitalContent.product?.productKind ===
                              "DIGITAL_VIDEO_SIGN" ? (
                              <Badge color="purple">🎬 動画</Badge>
                            ) : d.digitalContent.product?.productKind ===
                              "DIGITAL_PHOTO_SIGN" ? (
                              <Badge color="blue">📷 写真</Badge>
                            ) : null}
                          </div>
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
                        <td className="px-4 py-3 align-top">
                          <code className="block max-w-[14rem] truncate text-xs text-gray-500" title={suggestedName}>
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
                        <td className="px-4 py-3 align-top">
                          {d.signature?.status === "WRITTEN" ? (
                            // 主導線：サインが書かれている → プレビューページ + 承認/却下
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/admin/digital-deliveries/${d.id}/preview`}
                                className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              >
                                プレビュー
                              </Link>
                              <div className="flex flex-col gap-1">
                                <form action={approveSignature}>
                                  <input type="hidden" name="deliveryId" value={d.id} />
                                  <button
                                    type="submit"
                                    className="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                                  >
                                    承認して納品
                                  </button>
                                </form>
                                <form action={rejectSignature}>
                                  <input type="hidden" name="deliveryId" value={d.id} />
                                  <button
                                    type="submit"
                                    className="whitespace-nowrap rounded-lg border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                                  >
                                    書き直し
                                  </button>
                                </form>
                              </div>
                            </div>
                          ) : d.status === "READY" && d.fileKey?.startsWith("signature:") ? (
                            // 納品済み（サイン経由） → プレビュー + メール再送
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/admin/digital-deliveries/${d.id}/preview`}
                                className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              >
                                プレビュー
                              </Link>
                              {/* #39: 通知メールの手動再送 */}
                              <form action={resendSignatureReadyMail}>
                                <input
                                  type="hidden"
                                  name="deliveryId"
                                  value={d.id}
                                />
                                <button
                                  type="submit"
                                  className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                  title="通知メールを再送信します"
                                >
                                  メール再送
                                </button>
                              </form>
                            </div>
                          ) : (
                            // 代替導線：サイン未記入 → 原本DL + 手動アップロード（小さく）
                            // 原本未登録時は商品の編集画面へのリンクを提示
                            <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                              {d.digitalContent.baseImageKey ? (
                                <a
                                  href={`/api/admin/deliveries/base-image/${encodeURIComponent(d.digitalContent.baseImageKey)}`}
                                  className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                                >
                                  原本DL
                                </a>
                              ) : d.digitalContent.baseImageUrl ? (
                                <a
                                  href={d.digitalContent.baseImageUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                                >
                                  原本
                                </a>
                              ) : (() => {
                                const productId =
                                  d.digitalContent.productId ??
                                  d.orderItem.variant?.productId ??
                                  null;
                                return (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-amber-600">
                                      原本未登録
                                    </span>
                                    {productId && (
                                      <Link
                                        href={`/admin/products/${productId}`}
                                        className="rounded-lg border border-amber-300 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50"
                                      >
                                        商品を編集
                                      </Link>
                                    )}
                                  </div>
                                );
                              })()}
                              <DeliveryUploadRow
                                deliveryId={d.id}
                                isReady={d.status === "READY"}
                              />
                            </div>
                          )}
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
