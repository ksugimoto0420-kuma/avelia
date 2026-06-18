import { handleError, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { csvResponse, toCsv } from "@/lib/csv";
import { normalizeUnitNicknames } from "@/lib/nickname";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

// 制作リスト CSV（仕様書 10）。
// 数量分の宛名がある場合は1点1行に展開する。
// クエリ:
//   eventId, variantNames=A,B,C  : 絞り込み
//   preview=1, previewLimit=10   : プレビュー JSON
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin("OPERATOR");
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    const variantNamesRaw = searchParams.get("variantNames");
    const variantNames = variantNamesRaw
      ? variantNamesRaw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
    const preview = searchParams.get("preview") === "1";
    const previewLimit = Math.max(
      1,
      Math.min(50, Number(searchParams.get("previewLimit") ?? "10")),
    );

    const items = await prisma.orderItem.findMany({
      where: {
        order: { status: "PAID" },
        ...(eventId
          ? {
              variant: {
                product: { eventId },
                ...(variantNames.length > 0
                  ? { name: { in: variantNames } }
                  : {}),
              },
            }
          : variantNames.length > 0
            ? { variant: { name: { in: variantNames } } }
            : {}),
      },
      orderBy: { order: { createdAt: "asc" } },
      include: { order: { select: { orderNumber: true } } },
    });

    const headers = [
      "注文番号",
      "商品名",
      "バリエーション",
      "通番",
      "ニックネーム",
      "読み仮名",
      "備考",
    ];
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

    if (preview) {
      return ok({
        headers,
        rows: rows.slice(0, previewLimit),
        total: rows.length,
        eventId,
        variantNames,
      });
    }

    const csv = toCsv(headers, rows);

    await logOperation({
      adminUserId: admin.id,
      action: "export.production_list",
      detail: { eventId, variantNames, count: rows.length },
    });

    const safeSlug = (s: string) =>
      s.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 40);
    const eventLabel = eventId ? `event-${safeSlug(eventId)}` : "all-events";
    const memberLabel =
      variantNames.length > 0 ? `-${safeSlug(variantNames.join("_"))}` : "";
    const fileName = `production-list-${eventLabel}${memberLabel}.csv`;

    return csvResponse(fileName, csv);
  } catch (err) {
    return handleError(err);
  }
}
