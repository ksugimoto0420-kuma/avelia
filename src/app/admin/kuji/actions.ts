"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";
import { parseJstDateTimeLocal } from "@/lib/utils";

function parseDate(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || v.trim() === "") return null;
  return parseJstDateTimeLocal(v);
}

function parseIntOr(
  v: FormDataEntryValue | null,
  fallback: number,
): number {
  if (!v || typeof v !== "string" || v.trim() === "") return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : Math.trunc(n);
}

/* -------------------- KujiCampaign CRUD -------------------- */

export async function saveKujiCampaign(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");

  const id = (formData.get("id") as string | null) || null;
  const title = ((formData.get("title") as string) ?? "").trim();
  if (!title) throw new Error("くじタイトルは必須です");

  const saleStartAt = parseDate(formData.get("saleStartAt"));
  const saleEndAt = parseDate(formData.get("saleEndAt"));
  if (!saleStartAt || !saleEndAt) throw new Error("販売期間は必須です");
  if (saleEndAt <= saleStartAt) {
    throw new Error("販売終了日時は販売開始日時より後にしてください");
  }
  const pricePerDraw = parseIntOr(formData.get("pricePerDraw"), 0);
  if (pricePerDraw <= 0) throw new Error("1回あたりの単価は1円以上で設定してください");

  const data = {
    title,
    description: ((formData.get("description") as string) ?? "").trim() || null,
    bannerImageUrl:
      ((formData.get("bannerImageUrl") as string) ?? "").trim() || null,
    eventId: (formData.get("eventId") as string) || null,
    artistId: (formData.get("artistId") as string) || null,
    saleStartAt,
    saleEndAt,
    pricePerDraw,
    deliveryNote:
      ((formData.get("deliveryNote") as string) ?? "").trim() || null,
    notesText: ((formData.get("notesText") as string) ?? "").trim() || null,
    status: (formData.get("status") as string | null) === "OPEN" ? "OPEN" : "DRAFT",
  } as const;

  if (id) {
    await prisma.kujiCampaign.update({ where: { id }, data });
    await logOperation({
      adminUserId: admin.id,
      action: "kuji.update",
      targetType: "KujiCampaign",
      targetId: id,
    });
    revalidatePath("/admin/kuji");
    revalidatePath(`/admin/kuji/${id}`);
    redirect(`/admin/kuji/${id}`);
  } else {
    const created = await prisma.kujiCampaign.create({ data });
    await logOperation({
      adminUserId: admin.id,
      action: "kuji.create",
      targetType: "KujiCampaign",
      targetId: created.id,
    });
    revalidatePath("/admin/kuji");
    redirect(`/admin/kuji/${created.id}`);
  }
}

export async function deleteKujiCampaign(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("くじIDが指定されていません");
  const existing = await prisma.kujiCampaign.findUnique({
    where: { id },
    include: { _count: { select: { draws: true } } },
  });
  if (!existing) throw new Error("くじが見つかりません");
  if (existing._count.draws > 0) {
    throw new Error(
      `${existing._count.draws}件の抽選履歴があるため削除できません`,
    );
  }
  await prisma.kujiCampaign.delete({ where: { id } });
  await logOperation({
    adminUserId: admin.id,
    action: "kuji.delete",
    targetType: "KujiCampaign",
    targetId: id,
    detail: { title: existing.title },
  });
  revalidatePath("/admin/kuji");
  redirect("/admin/kuji");
}

/* -------------------- KujiPrize CRUD -------------------- */

export async function saveKujiPrize(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const campaignId = formData.get("campaignId") as string;
  if (!campaignId) throw new Error("くじIDが必要です");

  const id = (formData.get("id") as string | null) || null;
  const rank = ((formData.get("rank") as string) ?? "").trim();
  const name = ((formData.get("name") as string) ?? "").trim();
  if (!rank) throw new Error("ランク（S/A/B...）は必須です");
  if (!name) throw new Error("賞品名は必須です");
  const type = (formData.get("type") as string) === "LIMITED" ? "LIMITED" : "PROBABILITY";
  const order = parseIntOr(formData.get("order"), 0);
  const totalCount = parseIntOr(formData.get("totalCount"), 0);
  const probabilityWeight = parseIntOr(formData.get("probabilityWeight"), 0);
  const bundleOnly = formData.get("bundleOnly") === "on";

  const data = {
    campaignId,
    rank,
    name,
    imageUrl: ((formData.get("imageUrl") as string) ?? "").trim() || null,
    variantNote:
      ((formData.get("variantNote") as string) ?? "").trim() || null,
    type: type as "LIMITED" | "PROBABILITY",
    order,
    totalCount: type === "LIMITED" ? totalCount : null,
    remainingCount: type === "LIMITED" ? totalCount : null,
    probabilityWeight: type === "PROBABILITY" ? probabilityWeight : null,
    bundleOnly,
  } as const;

  if (type === "LIMITED" && totalCount <= 0) {
    throw new Error("本数制(LIMITED)賞は本数を1以上で指定してください");
  }
  if (type === "PROBABILITY" && probabilityWeight <= 0 && !bundleOnly) {
    throw new Error("確率制(PROBABILITY)賞は重みを1以上で指定してください");
  }

  if (id) {
    // 既存賞の場合、totalCount を変更したら remainingCount を再計算
    const existing = await prisma.kujiPrize.findUnique({ where: { id } });
    if (!existing) throw new Error("賞が見つかりません");
    let remainingCount = data.remainingCount;
    if (type === "LIMITED" && existing.type === "LIMITED" && existing.totalCount === totalCount) {
      // 本数据置き → 残数は変えない
      remainingCount = existing.remainingCount;
    }
    await prisma.kujiPrize.update({
      where: { id },
      data: { ...data, remainingCount },
    });
    await logOperation({
      adminUserId: admin.id,
      action: "kuji.prize.update",
      targetType: "KujiPrize",
      targetId: id,
    });
  } else {
    const created = await prisma.kujiPrize.create({ data });
    await logOperation({
      adminUserId: admin.id,
      action: "kuji.prize.create",
      targetType: "KujiPrize",
      targetId: created.id,
    });
  }

  revalidatePath(`/admin/kuji/${campaignId}`);
}

export async function deleteKujiPrize(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const id = formData.get("id") as string;
  const campaignId = formData.get("campaignId") as string;
  if (!id || !campaignId) throw new Error("IDが指定されていません");

  const existing = await prisma.kujiPrize.findUnique({
    where: { id },
    include: { _count: { select: { draws: true, bundleSlots: true } } },
  });
  if (!existing) throw new Error("賞が見つかりません");
  if (existing._count.draws > 0) {
    throw new Error("この賞は既に抽選で排出されているため削除できません");
  }
  if (existing._count.bundleSlots > 0) {
    throw new Error(
      "連数オマケに設定されている賞は削除できません。先に連数SKUからオマケ参照を外してください",
    );
  }
  await prisma.kujiPrize.delete({ where: { id } });
  await logOperation({
    adminUserId: admin.id,
    action: "kuji.prize.delete",
    targetType: "KujiPrize",
    targetId: id,
  });
  revalidatePath(`/admin/kuji/${campaignId}`);
}

/* -------------------- KujiBundle CRUD -------------------- */

export async function saveKujiBundle(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const campaignId = formData.get("campaignId") as string;
  if (!campaignId) throw new Error("くじIDが必要です");
  const id = (formData.get("id") as string | null) || null;
  const drawCount = parseIntOr(formData.get("drawCount"), 0);
  const priceTotal = parseIntOr(formData.get("priceTotal"), 0);
  const bonusPrizeId =
    ((formData.get("bonusPrizeId") as string) ?? "").trim() || null;
  const sku = ((formData.get("sku") as string) ?? "").trim() || null;

  if (drawCount <= 0) throw new Error("連数は1以上を指定してください");
  if (priceTotal <= 0) throw new Error("セット価格は1円以上を指定してください");

  const data = {
    campaignId,
    drawCount,
    priceTotal,
    bonusPrizeId,
    sku,
  };
  if (id) {
    await prisma.kujiBundle.update({ where: { id }, data });
    await logOperation({
      adminUserId: admin.id,
      action: "kuji.bundle.update",
      targetType: "KujiBundle",
      targetId: id,
    });
  } else {
    const created = await prisma.kujiBundle.create({ data });
    await logOperation({
      adminUserId: admin.id,
      action: "kuji.bundle.create",
      targetType: "KujiBundle",
      targetId: created.id,
    });
  }
  revalidatePath(`/admin/kuji/${campaignId}`);
}

export async function deleteKujiBundle(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const id = formData.get("id") as string;
  const campaignId = formData.get("campaignId") as string;
  if (!id || !campaignId) throw new Error("IDが指定されていません");
  await prisma.kujiBundle.delete({ where: { id } });
  await logOperation({
    adminUserId: admin.id,
    action: "kuji.bundle.delete",
    targetType: "KujiBundle",
    targetId: id,
  });
  revalidatePath(`/admin/kuji/${campaignId}`);
}
