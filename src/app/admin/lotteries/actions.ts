"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

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
