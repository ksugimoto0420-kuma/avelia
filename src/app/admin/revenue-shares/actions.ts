"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { computeRevenueSharesForPeriod } from "@/lib/revenueShare";

export async function runRevenueShare(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const period = (formData.get("period") as string)?.trim();
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error("期間は YYYY-MM 形式で入力してください");
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
