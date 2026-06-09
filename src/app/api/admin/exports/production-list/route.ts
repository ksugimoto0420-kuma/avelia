import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { csvResponse, toCsv } from "@/lib/csv";
import { normalizeUnitNicknames } from "@/lib/nickname";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

// 制作リスト CSV（仕様書 10）。
// 数量分の宛名がある場合は1点1行に展開する。
// 列: 注文番号, 商品名, バリエーション, 通番, ニックネーム, 読み仮名, 備考
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin("OPERATOR");
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    const items = await prisma.orderItem.findMany({
      where: {
        order: { status: "PAID" },
        ...(eventId ? { variant: { product: { eventId } } } : {}),
      },
      orderBy: { order: { createdAt: "asc" } },
      include: { order: { select: { orderNumber: true } } },
    });

    const rows: (string | number)[][] = [];
    for (const i of items) {
      const units = normalizeUnitNicknames(i.unitNicknames, i.quantity, {
        nickname: i.nickname,
        nicknameKana: i.nicknameKana,
        note: i.note,
      });
      units.forEach((u, idx) => {
        rows.push([
          i.order.orderNumber,
          i.productName,
          i.variantName,
          `${idx + 1}/${i.quantity}`,
          u.nickname ?? "",
          u.nicknameKana ?? "",
          u.note ?? "",
        ]);
      });
    }

    const csv = toCsv(
      ["注文番号", "商品名", "バリエーション", "通番", "ニックネーム", "読み仮名", "備考"],
      rows,
    );

    await logOperation({
      adminUserId: admin.id,
      action: "export.production_list",
      detail: { eventId, count: rows.length },
    });

    return csvResponse("production-list.csv", csv);
  } catch (err) {
    return handleError(err);
  }
}
