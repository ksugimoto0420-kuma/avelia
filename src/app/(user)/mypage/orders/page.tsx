import { MypageOrderList } from "@/components/user/MypageOrderList";
import { requireUserPage } from "@/lib/auth/user-page";
import { prisma } from "@/lib/prisma";

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

  const data = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    shipmentStatus: o.shipment?.status ?? null,
    total: o.total,
    items: o.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantName: i.variantName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  }));

  return <MypageOrderList orders={data} />;
}
