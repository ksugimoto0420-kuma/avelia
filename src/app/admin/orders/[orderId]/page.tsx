import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { normalizeUnitNicknames } from "@/lib/nickname";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";
import { refundOrder, updateShipment } from "./actions";

export const dynamic = "force-dynamic";

// 注文明細の数量分ニックネームを正規化して返す
function unitNicknamesOf(i: {
  unitNicknames: unknown;
  quantity: number;
  nickname: string | null;
  nicknameKana: string | null;
  note: string | null;
}) {
  return normalizeUnitNicknames(i.unitNicknames, i.quantity, {
    nickname: i.nickname,
    nicknameKana: i.nicknameKana,
    note: i.note,
  });
}

const SHIPMENT_OPTIONS = [
  "UNFULFILLED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
];
const SHIPMENT_LABEL: Record<string, string> = {
  UNFULFILLED: "未対応",
  PREPARING: "準備中",
  SHIPPED: "発送済",
  DELIVERED: "配達完了",
  RETURNED: "返品",
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await requireAdminPage();
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      items: { include: { variant: { include: { product: true } } } },
      payment: true,
      shipment: true,
    },
  });
  if (!order) notFound();

  const hasPhysical = order.items.some(
    (i) => i.variant.product.type === "PHYSICAL",
  );

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          注文 {order.orderNumber}
        </h1>
        <StatusBadge kind="order" status={order.status} />
        {order.payment && (
          <StatusBadge kind="payment" status={order.payment.status} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="注文明細" />
            <CardBody>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-gray-400">
                    <th className="py-2 text-left">商品</th>
                    <th className="py-2 text-right">単価</th>
                    <th className="py-2 text-right">数量</th>
                    <th className="py-2 text-right">小計</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.items.map((i) => (
                    <tr key={i.id}>
                      <td className="py-3">
                        <p className="font-medium text-gray-900">
                          {i.productName}
                        </p>
                        <p className="text-xs text-gray-400">{i.variantName}</p>
                        {unitNicknamesOf(i).map((u, idx) =>
                          u.nickname ? (
                            <p key={idx} className="mt-1 text-xs text-brand-600">
                              ニックネーム
                              {i.quantity >= 2 ? `(${idx + 1})` : ""}: {u.nickname}
                              {u.nicknameKana && `（${u.nicknameKana}）`}
                            </p>
                          ) : null,
                        )}
                      </td>
                      <td className="py-3 text-right">{formatYen(i.unitPrice)}</td>
                      <td className="py-3 text-right">{i.quantity}</td>
                      <td className="py-3 text-right font-medium">
                        {formatYen(i.unitPrice * i.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="mt-4 space-y-1 border-t border-gray-100 pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">小計</dt>
                  <dd>{formatYen(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">送料</dt>
                  <dd>{formatYen(order.shippingFee)}</dd>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <dt>合計</dt>
                  <dd className="text-brand-600">{formatYen(order.total)}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          {hasPhysical && (
            <Card>
              <CardHeader title="発送管理" />
              <CardBody>
                <form action={updateShipment} className="space-y-3">
                  <input type="hidden" name="orderId" value={order.id} />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">
                        ステータス
                      </label>
                      <select
                        name="status"
                        defaultValue={order.shipment?.status ?? "UNFULFILLED"}
                        className={inputCls}
                      >
                        {SHIPMENT_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {SHIPMENT_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">
                        配送業者
                      </label>
                      <input
                        name="carrier"
                        defaultValue={order.shipment?.carrier ?? ""}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">
                        追跡番号
                      </label>
                      <input
                        name="trackingNumber"
                        defaultValue={order.shipment?.trackingNumber ?? ""}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    発送情報を更新
                  </button>
                </form>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="お客様 / お届け先" />
            <CardBody className="space-y-1 text-sm text-gray-700">
              <p>{order.user.email}</p>
              {order.recipientName && <p>宛名: {order.recipientName}</p>}
              {order.recipientPhone && <p>TEL: {order.recipientPhone}</p>}
              {order.recipientPostal && <p>〒{order.recipientPostal}</p>}
              {order.recipientAddress && <p>{order.recipientAddress}</p>}
              {order.shippingMethod && (
                <p className="text-gray-400">配送: {order.shippingMethod}</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="決済情報" />
            <CardBody className="space-y-1 text-sm text-gray-700">
              <p>プロバイダ: {order.payment?.provider ?? "-"}</p>
              <p>
                決済ID:{" "}
                <span className="break-all text-xs text-gray-400">
                  {order.payment?.providerPaymentId ?? "-"}
                </span>
              </p>
              <p>支払日時: {formatDateTime(order.paidAt)}</p>
              {order.status === "PAID" && (
                <form action={refundOrder} className="pt-3">
                  <input type="hidden" name="orderId" value={order.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    返金する（MANAGER以上）
                  </button>
                </form>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
