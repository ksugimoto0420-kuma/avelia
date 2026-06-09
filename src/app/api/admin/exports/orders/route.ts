import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { csvResponse, toCsv } from "@/lib/csv";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin("OPERATOR");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const orders = await prisma.order.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } }, payment: true },
    });

    const csv = toCsv(
      ["注文番号", "メール", "状態", "決済状態", "金額", "決済ID", "注文日時"],
      orders.map((o) => [
        o.orderNumber,
        o.user.email,
        o.status,
        o.payment?.status ?? "",
        o.total,
        o.payment?.providerPaymentId ?? "",
        formatDateTime(o.createdAt),
      ]),
    );

    await logOperation({
      adminUserId: admin.id,
      action: "export.orders",
      detail: { status, count: orders.length },
    });

    return csvResponse("orders.csv", csv);
  } catch (err) {
    return handleError(err);
  }
}
