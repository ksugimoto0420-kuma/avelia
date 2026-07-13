"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";
import { setSetting, type SettingKey } from "@/lib/settings";

const INTEGER_KEYS: SettingKey[] = [
  "shippingFlatRate",
  "shippingFreeThreshold",
  "rsTier1Threshold",
  "rsTier2Threshold",
];
const RATE_KEYS: SettingKey[] = [
  "paymentFeeRate",
  "rsTier1Rate",
  "rsTier2Rate",
  "rsTier3Rate",
];
const STRING_KEYS: SettingKey[] = [
  "supportEmail",
  "siteName",
  "heroImageUrl",
  "heroImages",
  // 納品書テンプレ (docs/orders-invoice-batch-spec.md 2-1)
  "invoiceCompanyName",
  "invoicePostalCode",
  "invoiceAddress",
  "invoicePhone",
  "invoiceEmail",
  "invoiceRepresentative",
  "invoiceFooterMessage",
];

export async function saveSettings(formData: FormData) {
  const admin = await requireAdmin("MANAGER");

  const changes: Record<string, string> = {};
  for (const k of INTEGER_KEYS) {
    const raw = (formData.get(k) as string | null)?.trim() ?? "";
    if (raw === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      throw new Error(`${k} は0以上の整数で入力してください`);
    }
    changes[k] = String(n);
  }
  for (const k of RATE_KEYS) {
    const raw = (formData.get(k) as string | null)?.trim() ?? "";
    if (raw === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      throw new Error(`${k} は 0〜1 の小数で入力してください（例: 0.029）`);
    }
    changes[k] = String(n);
  }
  for (const k of STRING_KEYS) {
    const raw = (formData.get(k) as string | null)?.trim();
    if (raw == null) continue;
    changes[k] = raw;
  }

  await prisma.$transaction(async (tx) => {
    for (const [k, v] of Object.entries(changes)) {
      await setSetting(tx, k as SettingKey, v);
    }
  });

  await logOperation({
    adminUserId: admin.id,
    action: "settings.update",
    targetType: "AppSetting",
    detail: changes,
  });

  revalidatePath("/admin/settings");
}
