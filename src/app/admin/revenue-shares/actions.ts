"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { computeRevenueSharesForPeriod } from "@/lib/revenueShare";

export async function runRevenueShare(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const period = (formData.get("period") as string | null)?.trim() ?? "";
  if (!period) {
    throw new Error("対象期間を入力してください（例: 2026-06）");
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new Error("対象期間は YYYY-MM 形式で入力してください（例: 2026-06）");
  }

  const results = await computeRevenueSharesForPeriod(period);
  await logOperation({
    adminUserId: admin.id,
    action: "revenue_share.compute",
    targetType: "RevenueShare",
    detail: { period, count: results.length },
  });

  revalidatePath("/admin/revenue-shares");
}
