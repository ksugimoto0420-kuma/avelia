import type {
  OrderStatus,
  Prisma,
  ShipmentStatus,
} from "@prisma/client";
import JSZip from "jszip";
import { AppError, handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { buildInvoicePropsForOrder } from "@/lib/pdf/buildInvoiceProps";
import {
  renderInvoiceBuffer,
  renderInvoiceBundleBuffer,
} from "@/lib/pdf/renderInvoice";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
// 件数によっては数十秒かかる。Hobby 枠を超えたら適宜非同期化 (次フェーズ)。
export const maxDuration = 60;

/**
 * POST /api/admin/exports/invoices
 * body: {
 *   format: "zip" | "pdf",
 *   from?: string (ISO datetime), to?: string,
 *   orderStatuses?: OrderStatus[], shipmentStatuses?: ShipmentStatus[],
 *   eventId?: string,
 * }
 *
 * 仕様書 5-5 に準拠。ZIP は 1件ごとの PDF 群、pdf は連結 1ファイル。
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin("OPERATOR");
    const body = (await req.json()) as {
      format?: "zip" | "pdf";
      from?: string;
      to?: string;
      orderStatuses?: string[];
      shipmentStatuses?: string[];
      eventId?: string;
    };
    const format = body.format ?? "zip";

    const where: Prisma.OrderWhereInput = {};
    // 期間
    if (body.from || body.to) {
      where.createdAt = {
        ...(body.from ? { gte: new Date(body.from) } : {}),
        ...(body.to ? { lte: new Date(body.to) } : {}),
      };
    }
    // 注文ステータス (既定: PAID / CANCELLED でない支払済系)
    const orderStatuses =
      body.orderStatuses && body.orderStatuses.length > 0
        ? (body.orderStatuses as OrderStatus[])
        : (["PAID"] as OrderStatus[]);
    where.status = { in: orderStatuses };
    // 発送ステータス (物販系のみ絞りたいときに指定)
    const shipmentStatuses =
      body.shipmentStatuses && body.shipmentStatuses.length > 0
        ? (body.shipmentStatuses as ShipmentStatus[])
        : null;
    if (shipmentStatuses) {
      where.shipment = {
        status: { in: shipmentStatuses },
      };
    }
    // イベント
    if (body.eventId) {
      where.items = {
        some: { variant: { product: { eventId: body.eventId } } },
      };
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        orderNumber: true,
        user: { select: { name: true } },
        recipientName: true,
      },
    });
    if (orders.length === 0) {
      throw new AppError("該当する注文がありません", 404);
    }

    // 全件の props を先に準備 (Font register が initial call でしか走らないため)
    const invoices = [];
    for (const o of orders) {
      const p = await buildInvoicePropsForOrder(o.id);
      if (p) invoices.push({ meta: o, props: p });
    }
    if (invoices.length === 0) {
      throw new AppError("納品書を生成できる注文がありません", 404);
    }

    const yyyymmdd = toYYYYMMDD(new Date());

    await logOperation({
      adminUserId: admin.id,
      action: "invoice.bulk_export",
      targetType: "Order",
      targetId: orders[0].id,
      detail: {
        format,
        count: invoices.length,
        filters: {
          from: body.from ?? null,
          to: body.to ?? null,
          orderStatuses,
          shipmentStatuses,
          eventId: body.eventId ?? null,
        },
      },
    });

    if (format === "pdf") {
      const title = `納品書_${yyyymmdd}_${invoices.length}件`;
      const buf = await renderInvoiceBundleBuffer(
        invoices.map((i) => i.props),
        title,
      );
      return new Response(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(title)}.pdf`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    // ZIP: 1件ごとの PDF を並べる。同名衝突は連番で回避 (仕様書 9)。
    const zip = new JSZip();
    const usedNames = new Set<string>();
    for (const inv of invoices) {
      const buf = await renderInvoiceBuffer(inv.props);
      const recipient =
        (inv.meta.recipientName || inv.meta.user?.name || "宛名なし").trim();
      let name = `納品書_${inv.meta.orderNumber}_${recipient}.pdf`;
      let n = 2;
      while (usedNames.has(name)) {
        name = `納品書_${inv.meta.orderNumber}_${recipient}_${n}.pdf`;
        n++;
      }
      usedNames.add(name);
      zip.file(name, buf);
    }
    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
    const zipName = `納品書_${yyyymmdd}_${invoices.length}件.zip`;
    return new Response(new Uint8Array(zipBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

function toYYYYMMDD(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
