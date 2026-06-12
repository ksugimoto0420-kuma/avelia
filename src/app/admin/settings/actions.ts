"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";
import { setSetting, type SettingKey } from "@/lib/settings";

const NUMBER_KEYS: SettingKey[] = ["shippingFlatRate", "shippingFreeThreshold"];
const STRING_KEYS: SettingKey[] = ["supportEmail", "siteName"];

export async function saveSettings(formData: FormData) {
  const admin = await requireAdmin("MANAGER");

  const changes: Record<string, string> = {};
  for (const k of NUMBER_KEYS) {
    const raw = (formData.get(k) as string | null)?.trim() ?? "";
    if (raw === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      throw new Error(`${k} は0以上の整数で入力してください`);
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
