import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card, CardBody } from "@/components/ui/Card";
import { requireUserPage } from "@/lib/auth/user-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MypageOrders() {
  const user = await requireUserPage("/mypage/orders");
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { items: true, shipment: true },
  });

  if (orders.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
        まだ注文がありません
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((o) => (
        <Card key={o.id}>
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">{o.orderNumber}</p>
                <p className="text-xs text-gray-400">
                  {formatDateTime(o.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge kind="order" status={o.status} />
                {o.shipment && (
                  <StatusBadge kind="shipment" status={o.shipment.status} />
                )}
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-gray-600">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>
                    {i.productName}（{i.variantName}）× {i.quantity}
                  </span>
                  <span>{formatYen(i.unitPrice * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
              <Link
                href={`/mypage/orders/${o.id}`}
                className="font-medium text-brand-600 hover:underline"
              >
                注文詳細を見る →
              </Link>
              <span className="font-bold">
                合計 {formatYen(o.total)}
              </span>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
