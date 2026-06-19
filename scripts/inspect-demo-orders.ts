import { prisma } from "../src/lib/prisma";

async function main() {
  const orders = await prisma.order.findMany({
    where: { orderNumber: { startsWith: "AV-DEMO-" } },
    include: { payment: true },
    orderBy: { createdAt: "asc" },
  });
  for (const o of orders) {
    console.log(
      `${o.orderNumber} status=${o.status} createdAt=${o.createdAt.toISOString()} paidAt=${o.paidAt?.toISOString() ?? "null"} cancelledAt=${o.cancelledAt?.toISOString() ?? "null"}`,
    );
    console.log(
      `  payment status=${o.payment?.status} createdAt=${o.payment?.createdAt.toISOString()} paidAt=${o.payment?.paidAt?.toISOString() ?? "null"} refundedAt=${o.payment?.refundedAt?.toISOString() ?? "null"}`,
    );
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
