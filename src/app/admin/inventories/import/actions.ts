"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

export type ImportResult = {
  total: number;
  updated: number;
  skipped: number;
  errors: { line: number; sku: string; message: string }[];
};

/** シンプルなCSVパーサ（カンマ区切り、ダブルクオート対応）。 */
function parseCsv(text: string): string[][] {
  // BOM を除去
  const t = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let cur: string[] = [];
  let buf = "";
  let inQuote = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuote) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          buf += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        buf += c;
      }
    } else {
      if (c === '"') {
        inQuote = true;
      } else if (c === ",") {
        cur.push(buf);
        buf = "";
      } else if (c === "\n") {
        cur.push(buf);
        rows.push(cur);
        cur = [];
        buf = "";
      } else if (c === "\r") {
        // 次の \n と合わせて改行扱い
      } else {
        buf += c;
      }
    }
  }
  if (buf.length > 0 || cur.length > 0) {
    cur.push(buf);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export async function importInventoriesCsv(
  formData: FormData,
): Promise<ImportResult> {
  const admin = await requireAdmin("OPERATOR");
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("CSVファイルを選択してください");
  }
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("CSVが空です");

  // ヘッダ行を読み取り、sku / quantity のインデックスを得る
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const skuIdx = header.indexOf("sku");
  const qtyIdx = header.indexOf("quantity");
  const thresholdIdx = header.indexOf("lowstockthreshold");
  if (skuIdx === -1 || qtyIdx === -1) {
    throw new Error('ヘッダ行に "sku" と "quantity" が必要です');
  }

  const result: ImportResult = {
    total: rows.length - 1,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const sku = (cells[skuIdx] ?? "").trim();
    const qtyRaw = (cells[qtyIdx] ?? "").trim();
    if (!sku) {
      result.errors.push({ line: i + 1, sku: "", message: "skuが空です" });
      continue;
    }
    if (qtyRaw === "") {
      result.skipped++;
      continue;
    }
    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
      result.errors.push({
        line: i + 1,
        sku,
        message: `quantityが不正: ${qtyRaw}`,
      });
      continue;
    }

    const threshold =
      thresholdIdx >= 0 && (cells[thresholdIdx] ?? "").trim() !== ""
        ? Number((cells[thresholdIdx] ?? "").trim())
        : undefined;

    try {
      await prisma.$transaction(async (tx) => {
        const variant = await tx.productVariant.findUnique({
          where: { sku },
          include: { inventory: true },
        });
        if (!variant) {
          throw new Error("SKUが見つかりません");
        }
        const inv = await tx.inventory.upsert({
          where: { variantId: variant.id },
          create: { variantId: variant.id, quantity: 0 },
          update: {},
        });
        const before = inv.quantity;
        const delta = qty - before;
        if (delta !== 0) {
          await tx.inventory.update({
            where: { variantId: variant.id },
            data: { quantity: qty },
          });
          await tx.inventoryAdjustment.create({
            data: {
              inventoryId: inv.id,
              variantId: variant.id,
              delta,
              before,
              after: qty,
              reason: "CSV_IMPORT",
              note: `CSV取込 (line ${i + 1})`,
              adminUserId: admin.id,
            },
          });
        }
        if (threshold != null && Number.isInteger(threshold) && threshold >= 0) {
          await tx.inventory.update({
            where: { variantId: variant.id },
            data: { lowStockThreshold: threshold, lowStockAlertedAt: null },
          });
        }
      });
      result.updated++;
    } catch (e) {
      result.errors.push({
        line: i + 1,
        sku,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await logOperation({
    adminUserId: admin.id,
    action: "inventory.csv_import",
    targetType: "Inventory",
    detail: {
      total: result.total,
      updated: result.updated,
      errors: result.errors.length,
    },
  });

  revalidatePath("/admin/inventories");
  return result;
}
