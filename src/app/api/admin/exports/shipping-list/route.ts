import { AppError, handleError, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { csvResponse, toCsv } from "@/lib/csv";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

// 発送リスト CSV（仕様書 10）。物販を含む支払済注文が対象。
// クエリ:
//   source = all | in_house | warehouse  (デフォルト all)
//   format = standard | yamato (デフォルト standard)
//   preview = 1            : CSV ではなく { headers, rows, total } の JSON を返す
//   previewLimit = 10      : preview 時のサンプル行数（デフォルト 10）
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin("OPERATOR");

    const url = new URL(req.url);
    const source = (url.searchParams.get("source") ?? "all").toLowerCase();
    const format = (url.searchParams.get("format") ?? "standard").toLowerCase();
    const preview = url.searchParams.get("preview") === "1";
    const previewLimit = Math.max(
      1,
      Math.min(50, Number(url.searchParams.get("previewLimit") ?? "10")),
    );
    if (!["all", "in_house", "warehouse"].includes(source)) {
      throw new AppError("source パラメータが不正です", 400);
    }
    if (!["standard", "yamato"].includes(format)) {
      throw new AppError("format パラメータが不正です", 400);
    }

    const fulfillmentFilter =
      source === "in_house"
        ? { fulfillmentSource: "IN_HOUSE" as const }
        : source === "warehouse"
          ? { fulfillmentSource: "WAREHOUSE" as const }
          : {};

    const orders = await prisma.order.findMany({
      where: {
        status: "PAID",
        items: {
          some: {
            variant: {
              product: { type: "PHYSICAL", ...fulfillmentFilter },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        shipment: true,
      },
    });

    // ヤマト形式は依頼主情報を出力するため、サイト名とサポート連絡先を取得
    const [shipperName, shipperPhone] =
      format === "yamato"
        ? await Promise.all([getSetting("siteName"), getSetting("supportEmail")])
        : ["", ""];

    let headers: string[];
    let rows: (string | number)[][];

    if (format === "yamato") {
      headers = [
        "お客様管理番号",
        "送り状種類",
        "クール区分",
        "出荷予定日",
        "お届け予定日",
        "配達時間帯",
        "お届け先電話番号",
        "お届け先郵便番号",
        "お届け先住所",
        "お届け先名",
        "お届け先名(カナ)",
        "ご依頼主電話番号",
        "ご依頼主郵便番号",
        "ご依頼主住所",
        "ご依頼主名",
        "品名コード1",
        "品名1",
        "品名コード2",
        "品名2",
        "記事",
      ];

      rows = orders.map((o) => {
        const physicalItems = o.items.filter(
          (i) =>
            i.variant.product.type === "PHYSICAL" &&
            (source === "all" ||
              (source === "in_house" &&
                i.variant.product.fulfillmentSource === "IN_HOUSE") ||
              (source === "warehouse" &&
                i.variant.product.fulfillmentSource === "WAREHOUSE")),
        );
        const item1 = physicalItems[0];
        const item2 = physicalItems[1];
        const item1Label = item1
          ? `${item1.productName}(${item1.variantName})x${item1.quantity}`
          : "";
        const item2Label = item2
          ? `${item2.productName}(${item2.variantName})x${item2.quantity}`
          : "";
        const extraNote =
          physicalItems.length > 2
            ? `他${physicalItems.length - 2}商品同梱`
            : "";
        return [
          o.orderNumber,
          "0",
          "0",
          "",
          "",
          "",
          o.recipientPhone ?? "",
          o.recipientPostal ?? "",
          o.recipientAddress ?? "",
          o.recipientName ?? "",
          o.recipientKana ?? "",
          shipperPhone ?? "",
          "",
          "",
          shipperName ?? "",
          item1?.variant.sku ?? "",
          item1Label,
          item2?.variant.sku ?? "",
          item2Label,
          extraNote,
        ];
      });
    } else {
      // 標準形式
      headers = [
        "注文番号",
        "氏名",
        "フリガナ",
        "郵便番号",
        "住所",
        "電話番号",
        "商品明細",
        "配送方法",
        "発送状態",
      ];
      rows = orders.map((o) => {
        const detail = o.items
          .filter(
            (i) =>
              i.variant.product.type === "PHYSICAL" &&
              (source === "all" ||
                (source === "in_house" &&
                  i.variant.product.fulfillmentSource === "IN_HOUSE") ||
                (source === "warehouse" &&
                  i.variant.product.fulfillmentSource === "WAREHOUSE")),
          )
          .map((i) => `${i.productName}(${i.variantName})x${i.quantity}`)
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
    }

    if (preview) {
      return ok({
        headers,
        rows: rows.slice(0, previewLimit),
        total: rows.length,
        source,
        format,
      });
    }

    const csv = toCsv(headers, rows);

    await logOperation({
      adminUserId: admin.id,
      action: "export.shipping_list",
      detail: { count: orders.length, source, format },
    });

    const sourceLabel =
      source === "in_house"
        ? "in-house"
        : source === "warehouse"
          ? "warehouse"
          : "all";
    const formatLabel = format === "yamato" ? "-yamato" : "";
    return csvResponse(`shipping-list${formatLabel}-${sourceLabel}.csv`, csv);
  } catch (err) {
    return handleError(err);
  }
}
