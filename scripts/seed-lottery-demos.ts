/**
 * デモ用に「受付中 (OPEN)」「締切 (CLOSED)」の抽選サンプルを追加する。
 *
 * 「下書き」は既に手動で 1 件作られているのでスキップ。すでに同名タイトルが
 * あれば冪等にスキップ（再実行可）。
 *
 * - OPEN: 応募期間まだ続いている。テストユーザーが応募済み（実行ボタンは
 *   "応募締切前"で無効）
 * - CLOSED: 応募締切後・状態 CLOSED・応募者 1 名（実行ボタン有効）
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const now = new Date();

  // 1) 紐付け先の event / product を 1 件ずつ拾う（直近で公開済みのもの優先）
  const event = await prisma.event.findFirst({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });
  if (!event) throw new Error("event が無いためデモデータを作れません");

  const product = await prisma.product.findFirst({
    where: { eventId: event.id, isPublished: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });
  if (!product) throw new Error("product が無いためデモデータを作れません");

  // 2) 応募テスト用の一般ユーザーを 1 名拾う
  const testUser = await prisma.user.findFirst({
    where: { email: { not: { endsWith: "@deleted.local" } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!testUser) throw new Error("user が無いためデモデータを作れません");

  console.log(
    `event=${event.title} / product=${product.name} / user=${testUser.email}`,
  );

  // 3) OPEN（受付中）
  const openTitle = "抽選デモ（受付中）";
  const openExisting = await prisma.lottery.findFirst({
    where: { title: openTitle },
    select: { id: true },
  });
  if (openExisting) {
    console.log(`[OPEN] 既に存在: ${openExisting.id} → スキップ`);
  } else {
    const opened = await prisma.lottery.create({
      data: {
        title: openTitle,
        description:
          "デモ用の受付中サンプル。応募締切までは抽選実行ボタンが無効化されます。",
        eventId: event.id,
        productId: product.id,
        entryStartAt: addDays(now, -3),
        entryEndAt: addDays(now, 7),
        purchaseDeadlineAt: addDays(now, 14),
        winnersCount: 5,
        status: "OPEN",
      },
    });
    // テストユーザーで応募
    await prisma.lotteryEntry.create({
      data: { lotteryId: opened.id, userId: testUser.id },
    });
    console.log(`[OPEN] created: ${opened.id} (entries=1)`);
  }

  // 4) CLOSED（締切・抽選実行可能）
  const closedTitle = "抽選デモ（締切・実行可能）";
  const closedExisting = await prisma.lottery.findFirst({
    where: { title: closedTitle },
    select: { id: true },
  });
  if (closedExisting) {
    console.log(`[CLOSED] 既に存在: ${closedExisting.id} → スキップ`);
  } else {
    const closed = await prisma.lottery.create({
      data: {
        title: closedTitle,
        description:
          "デモ用の締切済みサンプル。応募者 1 名のため、抽選実行ボタンを押せます。",
        eventId: event.id,
        productId: product.id,
        entryStartAt: addDays(now, -10),
        entryEndAt: addDays(now, -1), // 締切は昨日
        purchaseDeadlineAt: addDays(now, 14),
        winnersCount: 1,
        status: "CLOSED",
      },
    });
    await prisma.lotteryEntry.create({
      data: { lotteryId: closed.id, userId: testUser.id },
    });
    console.log(`[CLOSED] created: ${closed.id} (entries=1)`);
  }

  console.log("✅ done");
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
