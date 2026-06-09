import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { csvResponse, toCsv } from "@/lib/csv";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

// 発送リスト CSV（仕様書 10）。物販を含む支払済注文が対象。
// 列: 注文番号, 氏名, フリガナ, 郵便番号, 住所, 電話番号, 商品明細, 配送方法, 発送状態
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin("OPERATOR");

    const orders = await prisma.order.findMany({
      where: {
        status: "PAID",
        items: { some: { variant: { product: { type: "PHYSICAL" } } } },
      },
      orderBy: { createdAt: "asc" },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        shipment: true,
      },
    });

    const rows = orders.map((o) => {
      const detail = o.items
        .filter((i) => i.variant.product.type === "PHYSICAL")
        .map((i) => `${i.productName}（${i.variantName}）x${i.quantity}`)
        .join(" / ");
      return [
        o.orderNumber,
        o.recipientName ?? "",
        o.recipientKana ?? "",
        o.recipientPostal ?? "",
        o.recipientAddress ?? "",
        o.recipientPhone ?? "",
        detail,
        o.shippingMethod ?? "",
        o.shipment?.status ?? "UNFULFILLED",
      ];
    });

    const csv = toCsv(
      [
        "注文番号",
        "氏名",
        "フリガナ",
        "郵便番号",
        "住所",
        "電話番号",
        "商品明細",
        "配送方法",
        "発送状態",
      ],
      rows,
    );

    await logOperation({
      adminUserId: admin.id,
      action: "export.shipping_list",
      detail: { count: orders.length },
    });

    return csvResponse("shipping-list.csv", csv);
  } catch (err) {
    return handleError(err);
  }
}
