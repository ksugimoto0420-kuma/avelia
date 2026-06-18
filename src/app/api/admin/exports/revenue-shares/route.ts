import { handleError, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { csvResponse, toCsv } from "@/lib/csv";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin("MANAGER");
    const { searchParams } = new URL(req.url);
    const preview = searchParams.get("preview") === "1";
    const previewLimit = Math.max(
      1,
      Math.min(50, Number(searchParams.get("previewLimit") ?? "10")),
    );

    const shares = await prisma.revenueShare.findMany({
      orderBy: [{ period: "desc" }],
      include: { event: { select: { title: true } } },
    });

    const headers = [
      "期間",
      "イベント",
      "総売上",
      "決済手数料",
      "送料",
      "返金",
      "外部費",
      "弊社率",
      "弊社取り分",
      "Avelia取り分",
    ];
    const rows: (string | number)[][] = shares.map((s) => [
      s.period,
      s.event?.title ?? "",
      s.grossSales,
      s.paymentFee,
      s.shippingFee,
      s.refunds,
      s.externalCost,
      s.ourShareRate,
      s.ourAmount,
      s.aveliaAmount,
    ]);

    if (preview) {
      return ok({
        headers,
        rows: rows.slice(0, previewLimit),
        total: rows.length,
      });
    }

    const csv = toCsv(headers, rows);

    await logOperation({
      adminUserId: admin.id,
      action: "export.revenue_shares",
      detail: { count: shares.length },
    });

    return csvResponse("revenue-shares.csv", csv);
  } catch (err) {
    return handleError(err);
  }
}
