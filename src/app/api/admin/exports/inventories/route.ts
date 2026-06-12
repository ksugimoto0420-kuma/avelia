import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { csvResponse, toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();
    const rows = await prisma.productVariant.findMany({
      include: {
        inventory: true,
        product: { include: { event: { select: { title: true } } } },
      },
      orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
    });

    const headers = [
      "sku",
      "event",
      "product",
      "variant",
      "quantity",
      "reserved",
      "sold",
      "available",
      "lowStockThreshold",
    ];
    const lines = rows.map((v) => {
      const q = v.inventory?.quantity ?? 0;
      const r = v.inventory?.reserved ?? 0;
      const s = v.inventory?.sold ?? 0;
      return [
        v.sku,
        v.product.event.title,
        v.product.name,
        v.name,
        q,
        r,
        s,
        q - r - s,
        v.inventory?.lowStockThreshold ?? "",
      ];
    });

    const today = new Date().toISOString().slice(0, 10);
    return csvResponse(`inventories_${today}.csv`, toCsv(headers, lines));
  } catch (err) {
    return handleError(err);
  }
}
