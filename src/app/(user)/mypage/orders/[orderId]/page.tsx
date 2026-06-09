import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireUserPage } from "@/lib/auth/user-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "注文詳細" };

export default async function MypageOrderDetail({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await requireUserPage(`/mypage/orders/${orderId}`);

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    include: {
      items: {
        include: {
          variant: { include: { product: { include: { event: true } } } },
        },
      },
      payment: true,
      shipment: true,
    },
  });
  if (!order) notFound();

  const physicalItems = order.items.filter(
    (i) => i.variant.product.type === "PHYSICAL",
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/mypage/orders"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 注文履歴に戻る
        </Link>
      </div>

      {/* ヘッダー */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-gray-400">注文番号</p>
              <p className="text-lg font-bold text-gray-900">
                {order.orderNumber}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                注文日時：{formatDateTime(order.createdAt)}
              </p>
              {order.paidAt && (
                <p className="text-xs text-gray-400">
                  支払日時：{formatDateTime(order.paidAt)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge kind="order" status={order.status} />
              {order.shipment && (
                <StatusBadge kind="shipment" status={order.shipment.status} />
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 商品明細 */}
      <Card>
        <CardHeader title="ご注文商品" />
        <CardBody>
          <ul className="divide-y divide-gray-100">
            {order.items.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-start justify-between gap-2 py-3"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/events/${i.variant.product.eventId}`}
                    className="text-sm font-semibold text-gray-900 hover:text-brand-600"
                  >
                    {i.productName}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {i.variantName} × {i.quantity}
                  </p>
                  {i.nickname && (
                    <p className="mt-1 text-xs text-gray-500">
                      サイン宛名：<span className="text-gray-700">{i.nickname}</span>
                    </p>
                  )}
                  {i.note && (
                    <p className="text-xs text-gray-500">
                      メッセージ：<span className="text-gray-700">{i.note}</span>
                    </p>
                  )}
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-500">{formatYen(i.unitPrice)} × {i.quantity}</p>
                  <p className="font-semibold text-gray-900">
                    {formatYen(i.unitPrice * i.quantity)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-gray-100 pt-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <dt>小計</dt>
              <dd>{formatYen(order.subtotal)}</dd>
            </div>
            {order.shippingFee > 0 && (
              <div className="flex justify-between text-gray-600">
                <dt>送料</dt>
                <dd>{formatYen(order.shippingFee)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
              <dt>合計</dt>
              <dd>{formatYen(order.total)}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      {/* 配送先 */}
      {physicalItems.length > 0 && (
        <Card>
          <CardHeader title="お届け先" />
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="font-semibold text-gray-500">お名前</dt>
              <dd className="text-gray-800">
                {order.recipientName ?? "—"}
                {order.recipientKana && (
                  <span className="ml-2 text-xs text-gray-400">
                    （{order.recipientKana}）
                  </span>
                )}
              </dd>
              <dt className="font-semibold text-gray-500">郵便番号</dt>
              <dd className="text-gray-800">{order.recipientPostal ?? "—"}</dd>
              <dt className="font-semibold text-gray-500">住所</dt>
              <dd className="text-gray-800">{order.recipientAddress ?? "—"}</dd>
              <dt className="font-semibold text-gray-500">電話番号</dt>
              <dd className="text-gray-800">{order.recipientPhone ?? "—"}</dd>
              {order.shippingMethod && (
                <>
                  <dt className="font-semibold text-gray-500">配送方法</dt>
                  <dd className="text-gray-800">{order.shippingMethod}</dd>
                </>
              )}
            </dl>
          </CardBody>
        </Card>
      )}

      {/* 配送状況 */}
      {order.shipment && (
        <Card>
          <CardHeader title="配送状況" />
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="font-semibold text-gray-500">ステータス</dt>
              <dd>
                <StatusBadge kind="shipment" status={order.shipment.status} />
              </dd>
              {order.shipment.carrier && (
                <>
                  <dt className="font-semibold text-gray-500">配送業者</dt>
                  <dd className="text-gray-800">{order.shipment.carrier}</dd>
                </>
              )}
              {order.shipment.trackingNumber && (
                <>
                  <dt className="font-semibold text-gray-500">追跡番号</dt>
                  <dd className="text-gray-800">
                    {order.shipment.trackingNumber}
                  </dd>
                </>
              )}
              {order.shipment.shippedAt && (
                <>
                  <dt className="font-semibold text-gray-500">発送日時</dt>
                  <dd className="text-gray-800">
                    {formatDateTime(order.shipment.shippedAt)}
                  </dd>
                </>
              )}
              {order.shipment.deliveredAt && (
                <>
                  <dt className="font-semibold text-gray-500">配達完了日時</dt>
                  <dd className="text-gray-800">
                    {formatDateTime(order.shipment.deliveredAt)}
                  </dd>
                </>
              )}
            </dl>
          </CardBody>
        </Card>
      )}

      {/* 決済情報 */}
      {order.payment && (
        <Card>
          <CardHeader title="お支払い" />
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="font-semibold text-gray-500">決済方法</dt>
              <dd className="text-gray-800">
                {order.payment.provider === "STRIPE" ? "クレジットカード" : order.payment.provider}
              </dd>
              <dt className="font-semibold text-gray-500">決済状態</dt>
              <dd>
                <StatusBadge kind="payment" status={order.payment.status} />
              </dd>
              <dt className="font-semibold text-gray-500">金額</dt>
              <dd className="text-gray-800">{formatYen(order.payment.amount)}</dd>
              {order.payment.refundedAt && (
                <>
                  <dt className="font-semibold text-gray-500">返金日時</dt>
                  <dd className="text-gray-800">
                    {formatDateTime(order.payment.refundedAt)}
                  </dd>
                </>
              )}
            </dl>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
