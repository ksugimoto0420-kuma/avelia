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
 * 抽選を実行する（ハイブリッド方式）。
 *   - pinned=true の応募は無条件に当選（事前指名枠）
 *   - 残り当選枠 = winnersCount - 指名数 を、ENTERED かつ pinned=false の応募から
 *     Fisher-Yates シャッフルで「ガチ抽選」する
 *   - 残りは LOST
 *
 * 透明性のため、OperationLog の detail に指名者・抽選者・指名理由を全件記録する。
 * 実行前に管理画面側で確認モーダルを必須とする（仕様書 9）。
 */
export async function drawLottery(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const lotteryId = formData.get("lotteryId") as string;

  type DrawResult = {
    pinnedWinners: { id: string; userId: string; userName: string | null; email: string; reason: string | null }[];
    randomWinners: { id: string; userId: string; userName: string | null; email: string }[];
    losers: { id: string; userId: string; userName: string | null; email: string }[];
  };

  const result = await prisma.$transaction(async (tx) => {
    const lottery = await tx.lottery.findUnique({
      where: { id: lotteryId },
      include: {
        entries: {
          where: { status: "ENTERED" },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!lottery) throw new Error("抽選が見つかりません");
    if (lottery.status === "DRAWN") throw new Error("既に抽選済みです");
    if (lottery.status === "DRAFT") {
      throw new Error(
        "下書きの抽選は実行できません。先に「受付中」に変更し、応募締切後に実行してください",
      );
    }
    const now = new Date();
    if (now < lottery.entryEndAt) {
      throw new Error("応募締切前は実行できません");
    }
    if (lottery.entries.length === 0) {
      throw new Error("応募者がいないため実行できません");
    }

    const pinned = lottery.entries.filter((e) => e.pinned);
    const unpinned = lottery.entries.filter((e) => !e.pinned);

    if (pinned.length > lottery.winnersCount) {
      throw new Error(
        `事前指名(${pinned.length}名)が当選枠(${lottery.winnersCount}名)を超えています。指名を減らしてください。`,
      );
    }

    // ガチ抽選: 残り枠を Fisher-Yates でシャッフル
    const remainingSlots = lottery.winnersCount - pinned.length;
    const shuffled = [...unpinned];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const randomWinners = shuffled.slice(0, remainingSlots);
    const losers = shuffled.slice(remainingSlots);

    // 当選確定（指名 + ガチ抽選）
    const allWinners = [...pinned, ...randomWinners];
    for (const w of allWinners) {
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

    const drawResult: DrawResult = {
      pinnedWinners: pinned.map((e) => ({
        id: e.id,
        userId: e.userId,
        userName: e.user.name,
        email: e.user.email,
        reason: e.pinReason,
      })),
      randomWinners: randomWinners.map((e) => ({
        id: e.id,
        userId: e.userId,
        userName: e.user.name,
        email: e.user.email,
      })),
      losers: losers.map((e) => ({
        id: e.id,
        userId: e.userId,
        userName: e.user.name,
        email: e.user.email,
      })),
    };
    return drawResult;
  });

  await logOperation({
    adminUserId: admin.id,
    action: "lottery.draw",
    targetType: "Lottery",
    targetId: lotteryId,
    detail: {
      pinnedCount: result.pinnedWinners.length,
      randomCount: result.randomWinners.length,
      loserCount: result.losers.length,
      pinnedWinners: result.pinnedWinners,
      randomWinners: result.randomWinners,
    },
  });

  revalidatePath("/admin/lotteries");
  revalidatePath(`/admin/lotteries/${lotteryId}`);
  revalidatePath(`/admin/lotteries/${lotteryId}/draw`);
}

/**
 * 指定の応募を事前指名する/解除する。
 * 抽選実行前(ENTERED + status != DRAWN)のみ可能。
 * 指名理由 (reason) も保存して、後でログ検証できるようにする。
 */
export async function setEntryPinned(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const entryId = formData.get("entryId") as string;
  const pinned = formData.get("pinned") === "true";
  const reason = ((formData.get("reason") as string | null) ?? "").trim() || null;

  if (!entryId) throw new Error("対象が不正です");

  const entry = await prisma.lotteryEntry.findUnique({
    where: { id: entryId },
    include: { lottery: { select: { id: true, status: true } } },
  });
  if (!entry) throw new Error("応募が見つかりません");
  if (entry.lottery.status === "DRAWN") {
    throw new Error("抽選実行済みのため指名を変更できません");
  }
  if (entry.status !== "ENTERED") {
    throw new Error("応募中ではないため指名できません");
  }

  await prisma.lotteryEntry.update({
    where: { id: entryId },
    data: pinned
      ? {
          pinned: true,
          pinnedAt: new Date(),
          pinnedById: admin.id,
          pinReason: reason,
        }
      : {
          pinned: false,
          pinnedAt: null,
          pinnedById: null,
          pinReason: null,
        },
  });

  await logOperation({
    adminUserId: admin.id,
    action: pinned ? "lottery.pin" : "lottery.unpin",
    targetType: "LotteryEntry",
    targetId: entryId,
    detail: {
      lotteryId: entry.lottery.id,
      reason,
    },
  });

  revalidatePath(`/admin/lotteries/${entry.lottery.id}`);
  revalidatePath(`/admin/lotteries/${entry.lottery.id}/draw`);
}

/**
 * 指定の複数応募をまとめて指名する。
 * UI 側で「絞り込んだ全員を指名」のような一括操作に使う。
 * 当選枠を超える場合はエラー（部分指名はせず原子性を保つ）。
 */
export async function bulkPinEntries(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const lotteryId = formData.get("lotteryId") as string;
  const reason = ((formData.get("reason") as string | null) ?? "").trim() || null;
  const entryIdsRaw = (formData.get("entryIds") as string | null) ?? "";
  const entryIds = entryIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!lotteryId) throw new Error("抽選IDが不正です");
  if (entryIds.length === 0) throw new Error("対象が選択されていません");

  await prisma.$transaction(async (tx) => {
    const lottery = await tx.lottery.findUnique({
      where: { id: lotteryId },
      include: { entries: { where: { status: "ENTERED" } } },
    });
    if (!lottery) throw new Error("抽選が見つかりません");
    if (lottery.status === "DRAWN") {
      throw new Error("抽選実行済みのため指名を変更できません");
    }

    const targetSet = new Set(entryIds);
    const targets = lottery.entries.filter((e) => targetSet.has(e.id));
    if (targets.length === 0) {
      throw new Error("対象の応募が見つかりません");
    }

    // 既存指名 + 今回指名候補（重複は1回）の総数が当選枠を超えないか
    const currentPinnedIds = new Set(
      lottery.entries.filter((e) => e.pinned).map((e) => e.id),
    );
    for (const t of targets) currentPinnedIds.add(t.id);
    if (currentPinnedIds.size > lottery.winnersCount) {
      throw new Error(
        `指名後の合計 ${currentPinnedIds.size}名 が当選枠 ${lottery.winnersCount}名 を超えます`,
      );
    }

    await tx.lotteryEntry.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: {
        pinned: true,
        pinnedAt: new Date(),
        pinnedById: admin.id,
        pinReason: reason,
      },
    });
  });

  await logOperation({
    adminUserId: admin.id,
    action: "lottery.pin.bulk",
    targetType: "Lottery",
    targetId: lotteryId,
    detail: {
      count: entryIds.length,
      entryIds,
      reason,
    },
  });

  revalidatePath(`/admin/lotteries/${lotteryId}`);
  revalidatePath(`/admin/lotteries/${lotteryId}/draw`);
}

/**
 * 抽選の指名を全て解除する（やり直し用）。
 */
export async function clearAllPins(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const lotteryId = formData.get("lotteryId") as string;
  if (!lotteryId) throw new Error("抽選IDが不正です");

  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    select: { status: true },
  });
  if (!lottery) throw new Error("抽選が見つかりません");
  if (lottery.status === "DRAWN") {
    throw new Error("抽選実行済みのため指名を変更できません");
  }

  const res = await prisma.lotteryEntry.updateMany({
    where: { lotteryId, pinned: true },
    data: {
      pinned: false,
      pinnedAt: null,
      pinnedById: null,
      pinReason: null,
    },
  });

  await logOperation({
    adminUserId: admin.id,
    action: "lottery.pin.clear",
    targetType: "Lottery",
    targetId: lotteryId,
    detail: { cleared: res.count },
  });

  revalidatePath(`/admin/lotteries/${lotteryId}`);
  revalidatePath(`/admin/lotteries/${lotteryId}/draw`);
}
