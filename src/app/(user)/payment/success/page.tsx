import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getOptionalUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "ご注文ありがとうございます" };

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderNumber } = await searchParams;
  const user = await getOptionalUser();

  const order = orderNumber
    ? await prisma.order.findFirst({
        where: {
          orderNumber,
          ...(user ? { userId: user.id } : {}),
        },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: { include: { event: { select: { title: true, eventDate: true } } } },
                },
              },
            },
          },
          payment: true,
          shipment: true,
        },
      })
    : null;

  const hasPhysical =
    order?.items.some((i) => i.variant.product.type === "PHYSICAL") ?? false;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
          ✓
        </div>
        <h1 className="mt-6 text-2xl font-bold text-gray-900">
          ご注文ありがとうございます
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          決済が完了しました。ご注文の控えはマイページからもご確認いただけます。
        </p>
      </div>

      {order ? (
        <>
          <Card>
            <CardHeader title="ご注文内容" />
            <CardBody className="space-y-4">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
                <dt className="font-semibold text-gray-500">注文番号</dt>
                <dd className="font-mono text-gray-900">{order.orderNumber}</dd>
                <dt className="font-semibold text-gray-500">ご注文日時</dt>
                <dd className="text-gray-800">{formatDateTime(order.createdAt)}</dd>
                <dt className="font-semibold text-gray-500">お支払い</dt>
                <dd>
                  <StatusBadge kind="order" status={order.status} />
                </dd>
                <dt className="font-semibold text-gray-500">ご請求合計</dt>
                <dd className="text-base font-bold text-gray-900">
                  {formatYen(order.total)}
                </dd>
              </dl>

              <ul className="divide-y divide-gray-100 border-t border-gray-100 pt-3">
                {order.items.map((i) => (
                  <li
                    key={i.id}
                    className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">
                        {i.productName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {i.variant.product.event.title} ／ {i.variantName} × {i.quantity}
                      </p>
                      {i.variant.product.event.eventDate && (
                        <p className="mt-1 text-xs text-brand-600">
                          開催日: {formatDate(i.variant.product.event.eventDate)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {formatYen(i.unitPrice * i.quantity)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {hasPhysical && order.recipientAddress && (
            <Card>
              <CardHeader title="お届け先" />
              <CardBody className="text-sm text-gray-700">
                <p>{order.recipientName} 様</p>
                {order.recipientPostal && <p>〒{order.recipientPostal}</p>}
                <p>{order.recipientAddress}</p>
                {order.recipientPhone && <p>TEL: {order.recipientPhone}</p>}
                <p className="mt-3 text-xs text-gray-500">
                  サイン入り商品は、サイン会開催後に発送いたします。
                  発送時には改めてご連絡いたします。
                </p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="この後の流れ" />
            <CardBody>
              <ol className="space-y-2 text-sm text-gray-700">
                <li className="flex gap-2">
                  <span className="font-bold text-brand-600">1.</span>
                  <span>
                    マイページの「注文履歴」で、いつでもご注文内容と配送状況をご確認いただけます。
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-brand-600">2.</span>
                  <span>
                    サイン会当日のライブ配信URLは、開催が近づきましたらイベント詳細ページに表示されます（視聴は任意）。
                  </span>
                </li>
                {hasPhysical && (
                  <li className="flex gap-2">
                    <span className="font-bold text-brand-600">3.</span>
                    <span>
                      サイン入り商品はサイン会終了後、各商品ページに記載のお届け予定日に発送いたします。
                    </span>
                  </li>
                )}
              </ol>
            </CardBody>
          </Card>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button href={`/mypage/orders/${order.id}`}>
              注文詳細を見る
            </Button>
            <Button href="/events" variant="outline">
              他のイベントを見る
            </Button>
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-brand-600"
            >
              トップに戻る
            </Link>
          </div>
        </>
      ) : (
        <>
          {orderNumber && (
            <p className="rounded-lg bg-gray-100 px-4 py-2 text-center text-sm text-gray-700">
              注文番号: {orderNumber}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button href="/mypage/orders">注文履歴を見る</Button>
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-brand-600"
            >
              トップに戻る
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
