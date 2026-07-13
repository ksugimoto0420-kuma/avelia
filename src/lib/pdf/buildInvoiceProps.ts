import type { InvoiceDocumentProps, InvoiceLine } from "./invoice";
import { getInvoiceIssuerInfo } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

/**
 * DB 上の Order から納品書 PDF 用 props を組み立てる。
 *
 * 発行番号 (invoiceNumber) は Order.orderNumber をそのまま採用する。
 * (orderNumber は AV-YYYYMM-XXXXXX 形式で一意性がある)
 */
export async function buildInvoicePropsForOrder(
  orderId: string,
): Promise<InvoiceDocumentProps | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true } },
      items: {
        select: {
          productName: true,
          variantName: true,
          quantity: true,
          unitPrice: true,
        },
      },
    },
  });
  if (!order) return null;

  const issuer = await getInvoiceIssuerInfo();

  const lines: InvoiceLine[] = order.items.map((i) => ({
    productName: i.productName,
    variantName: i.variantName,
    unitPrice: i.unitPrice,
    quantity: i.quantity,
  }));

  const recipientName =
    order.recipientName?.trim() || order.user?.name?.trim() || "お客様";

  return {
    invoiceNumber: order.orderNumber,
    issuedAt: formatDate(order.paidAt ?? order.createdAt),
    recipient: {
      name: recipientName,
      postalCode: order.recipientPostal ?? null,
      address: order.recipientAddress ?? null,
    },
    lines,
    shippingFee: order.shippingFee,
    totalAmount: order.total,
    issuer,
  };
}

function formatDate(d: Date): string {
  // JST 表示。UTC からの単純オフセットで、DST を持たない日本ロケール前提。
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
