"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export async function enterLottery(formData: FormData): Promise<void> {
  const user = await requireUser();
  const lotteryId = formData.get("lotteryId") as string | null;
  if (!lotteryId) throw new Error("抽選IDが指定されていません");

  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
  });
  if (!lottery) throw new Error("抽選が見つかりません");

  if (lottery.status !== "OPEN") {
    throw new Error("この抽選は応募を受け付けていません");
  }
  const now = new Date();
  if (lottery.entryStartAt > now) {
    throw new Error("応募はまだ開始していません");
  }
  if (lottery.entryEndAt < now) {
    throw new Error("応募期間は終了しました");
  }

  await prisma.lotteryEntry.upsert({
    where: {
      lotteryId_userId: { lotteryId, userId: user.id },
    },
    create: {
      lotteryId,
      userId: user.id,
      status: "ENTERED",
    },
    update: {}, // 既に応募済みなら何もしない（冪等）
  });

  revalidatePath("/lotteries");
  revalidatePath(`/lotteries/${lotteryId}`);
  revalidatePath("/mypage/lottery-results");
  redirect(`/lotteries/${lotteryId}?entered=1`);
}
