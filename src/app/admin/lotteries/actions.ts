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

function parseIntOr(v: FormDataEntryValue | null, fallback: number): number {
  if (!v || typeof v !== "string" || v.trim() === "") return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : Math.trunc(n);
}

export async function saveLottery(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");

  const id = (formData.get("id") as string | null) || null;
  const title = (formData.get("title") as string)?.trim();
  if (!title) throw new Error("抽選タイトルは必須です");

  const entryStartAt = parseDate(formData.get("entryStartAt"));
  const entryEndAt = parseDate(formData.get("entryEndAt"));
  if (!entryStartAt || !entryEndAt) {
    throw new Error("応募期間は必須です");
  }
  if (entryEndAt <= entryStartAt) {
    throw new Error("応募終了日時は応募開始日時より後にしてください");
  }

  const data = {
    title,
    description: (formData.get("description") as string)?.trim() || null,
    eventId: (formData.get("eventId") as string) || null,
    productId: (formData.get("productId") as string) || null,
    entryStartAt,
    entryEndAt,
    purchaseDeadlineAt: parseDate(formData.get("purchaseDeadlineAt")),
    winnersCount: parseIntOr(formData.get("winnersCount"), 0),
    status: (formData.get("status") as string | null) === "OPEN" ? "OPEN" : "DRAFT",
  } as const;

  if (id) {
    await prisma.lottery.update({ where: { id }, data });
    await logOperation({
      adminUserId: admin.id,
      action: "lottery.update",
      targetType: "Lottery",
      targetId: id,
    });
  } else {
    const created = await prisma.lottery.create({ data });
    await logOperation({
      adminUserId: admin.id,
      action: "lottery.create",
      targetType: "Lottery",
      targetId: created.id,
    });
  }

  revalidatePath("/admin/lotteries");
  redirect("/admin/lotteries");
}

export async function deleteLottery(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("抽選IDが指定されていません");

  const existing = await prisma.lottery.findUnique({
    where: { id },
    include: { _count: { select: { entries: true } } },
  });
  if (!existing) throw new Error("抽選が見つかりません");

  if (existing.status === "DRAWN") {
    throw new Error("抽選実行済みの抽選は削除できません");
  }
  if (existing._count.entries > 0) {
    throw new Error(
      `${existing._count.entries}件の応募があるため削除できません。状態を「締切」に変更するか、応募者対応後に削除してください。`,
    );
  }

  await prisma.lottery.delete({ where: { id } });
  await logOperation({
    adminUserId: admin.id,
    action: "lottery.delete",
    targetType: "Lottery",
    targetId: id,
    detail: { title: existing.title },
  });

  revalidatePath("/admin/lotteries");
  redirect("/admin/lotteries");
}

/**
 * 抽選を実行する。ENTERED の応募から winnersCount 名を当選にし、
 * 残りを落選にする。実行前に管理画面側で確認モーダルを必須とする（仕様書 9）。
 */
export async function drawLottery(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const lotteryId = formData.get("lotteryId") as string;

  await prisma.$transaction(async (tx) => {
    const lottery = await tx.lottery.findUnique({
      where: { id: lotteryId },
      include: { entries: { where: { status: "ENTERED" } } },
    });
    if (!lottery) throw new Error("抽選が見つかりません");
    if (lottery.status === "DRAWN") throw new Error("既に抽選済みです");

    const entries = [...lottery.entries];
    // Fisher-Yates シャッフル
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }

    const now = new Date();
    const winners = entries.slice(0, lottery.winnersCount);
    const losers = entries.slice(lottery.winnersCount);

    for (const w of winners) {
      await tx.lotteryEntry.update({
        where: { id: w.id },
        data: {
          status: "WON",
          wonAt: now,
          purchaseDeadlineAt: lottery.purchaseDeadlineAt,
        },
      });
    }
    if (losers.length > 0) {
      await tx.lotteryEntry.updateMany({
        where: { id: { in: losers.map((l) => l.id) } },
        data: { status: "LOST" },
      });
    }

    await tx.lottery.update({
      where: { id: lotteryId },
      data: { status: "DRAWN", drawAt: now },
    });
  });

  await logOperation({
    adminUserId: admin.id,
    action: "lottery.draw",
    targetType: "Lottery",
    targetId: lotteryId,
  });

  revalidatePath("/admin/lotteries");
}
