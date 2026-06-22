/**
 * 抽選デモ用に「応募者複数 / 当選枠を絞った」状態に整える。
 *
 * 「抽選デモ（締切・実行可能）」を対象に:
 *   - 当選枠を 3 名に
 *   - 応募者を最大 8 名（user@example.com + fan0X@example.com）にする
 *   - status=CLOSED（締切後）にして、抽選実行ボタンが押せる状態
 *
 * 「抽選デモ（受付中）」も同様に複数応募者にして「これから抽選される」
 * 状態を見せられるようにする。
 *
 * 冪等: 既存の entries を一度クリアしてから入れ直す。
 */
import { prisma } from "../src/lib/prisma";

const TARGETS: { title: string; status: "OPEN" | "CLOSED"; winnersCount: number; entryCount: number }[] = [
  {
    title: "抽選デモ（締切・実行可能）",
    status: "CLOSED",
    winnersCount: 3,
    entryCount: 8,
  },
  {
    title: "抽選デモ（受付中）",
    status: "OPEN",
    winnersCount: 2,
    entryCount: 5,
  },
];

async function main() {
  // 応募候補ユーザー: user + fan系
  const users = await prisma.user.findMany({
    where: { email: { endsWith: "@example.com" } },
    take: 20,
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (users.length < 5) throw new Error("候補ユーザーが足りません");

  for (const t of TARGETS) {
    const lottery = await prisma.lottery.findFirst({
      where: { title: t.title },
    });
    if (!lottery) {
      console.log(`スキップ: "${t.title}" が見つからない`);
      continue;
    }

    // 既存応募を全削除
    await prisma.lotteryEntry.deleteMany({ where: { lotteryId: lottery.id } });

    // 当選枠 / status / 期間を整える
    const now = new Date();
    const entryEnd = t.status === "CLOSED"
      ? new Date(now.getTime() - 24 * 60 * 60 * 1000) // 昨日
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1週間後

    await prisma.lottery.update({
      where: { id: lottery.id },
      data: {
        status: t.status === "CLOSED" ? "CLOSED" : "OPEN",
        winnersCount: t.winnersCount,
        entryStartAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        entryEndAt: entryEnd,
      },
    });

    // 応募者を投入
    const pickedUsers = users.slice(0, t.entryCount);
    for (const u of pickedUsers) {
      await prisma.lotteryEntry.create({
        data: {
          lotteryId: lottery.id,
          userId: u.id,
          status: "ENTERED",
        },
      });
    }
    console.log(
      `✓ "${t.title}" status=${t.status} winners=${t.winnersCount} entries=${pickedUsers.length}`,
    );
    console.log(
      `   応募者: ${pickedUsers.map((u) => u.email).join(", ")}`,
    );
  }

  console.log("\n✅ done");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
