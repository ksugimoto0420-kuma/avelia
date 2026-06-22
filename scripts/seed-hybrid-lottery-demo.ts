/**
 * ハイブリッド抽選UIのテスト用データを生成する。
 *
 * - 抽選 10 件を新規作成（CLOSED かつ応募締切後 → そのまま抽選実行できる状態）
 * - 各抽選に既存ユーザーから 12〜20 名を応募として割り当て
 * - 既存の DRAWN や OPEN の抽選には触らない
 *
 * 性別・会員年数の偏りでハイブリッド抽選の挙動を試せるよう、
 * シナリオごとに「全員女性」「ベテラン多め」「混在」などのテーマを付ける。
 */
import { prisma } from "../src/lib/prisma";

type Scenario = {
  title: string;
  description: string;
  winnersCount: number;
  // 応募者を選ぶ関数。フィルター後の userIds から最大 maxEntrants 名を取る。
  pickUserIds: (
    users: { id: string; email: string; gender: string | null; joinedAt: Date | null; createdAt: Date }[],
  ) => string[];
};

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function membershipDays(u: { joinedAt: Date | null; createdAt: Date }): number {
  const since = u.joinedAt ?? u.createdAt;
  return Math.floor((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24));
}

const SCENARIOS: Scenario[] = [
  {
    title: "【テスト】サイン色紙 抽選A（混在・小規模）",
    description: "性別・会員年数バラバラの応募者18名、当選枠5名。",
    winnersCount: 5,
    pickUserIds: (us) => shuffled(us).slice(0, 18).map((u) => u.id),
  },
  {
    title: "【テスト】チェキ会参加権 抽選B（女性多め）",
    description: "女性会員を中心に12名応募、当選枠3名。",
    winnersCount: 3,
    pickUserIds: (us) => {
      const female = us.filter((u) => u.gender === "FEMALE");
      const others = us.filter((u) => u.gender !== "FEMALE");
      return [
        ...shuffled(female).slice(0, 8),
        ...shuffled(others).slice(0, 4),
      ].map((u) => u.id);
    },
  },
  {
    title: "【テスト】通話会参加権 抽選C（ベテラン優遇テスト）",
    description: "会員1年超えのファン中心、当選枠4名。",
    winnersCount: 4,
    pickUserIds: (us) => {
      const senior = us.filter((u) => membershipDays(u) >= 365);
      const junior = us.filter((u) => membershipDays(u) < 365);
      return [
        ...shuffled(senior).slice(0, 10),
        ...shuffled(junior).slice(0, 5),
      ].map((u) => u.id);
    },
  },
  {
    title: "【テスト】限定写真集 抽選D（応募多数）",
    description: "全ユーザー応募想定（20名）、当選枠2名で厳しめ。",
    winnersCount: 2,
    pickUserIds: (us) => shuffled(us).slice(0, 20).map((u) => u.id),
  },
  {
    title: "【テスト】サイン入りTシャツ 抽選E（中規模）",
    description: "15名応募、当選枠6名。",
    winnersCount: 6,
    pickUserIds: (us) => shuffled(us).slice(0, 15).map((u) => u.id),
  },
  {
    title: "【テスト】先行物販入場権 抽選F（男性多め）",
    description: "男性ファン中心の応募構成、当選枠4名。",
    winnersCount: 4,
    pickUserIds: (us) => {
      const male = us.filter((u) => u.gender === "MALE");
      const others = us.filter((u) => u.gender !== "MALE");
      return [
        ...shuffled(male).slice(0, 6),
        ...shuffled(others).slice(0, 6),
      ].map((u) => u.id);
    },
  },
  {
    title: "【テスト】VIPトークイベント 抽選G（少人数枠）",
    description: "応募17名、VIP想定で当選枠は1名のみ。",
    winnersCount: 1,
    pickUserIds: (us) => shuffled(us).slice(0, 17).map((u) => u.id),
  },
  {
    title: "【テスト】配信特典 抽選H（広めの枠）",
    description: "応募14名、当選枠8名で「ほぼ当たる」想定。",
    winnersCount: 8,
    pickUserIds: (us) => shuffled(us).slice(0, 14).map((u) => u.id),
  },
  {
    title: "【テスト】サインボール 抽選I（古参×新規 混在）",
    description: "古参10名 + 新規6名で会員日数フィルター挙動を確認。",
    winnersCount: 5,
    pickUserIds: (us) => {
      const senior = us.filter((u) => membershipDays(u) >= 200);
      const junior = us.filter((u) => membershipDays(u) < 200);
      return [
        ...shuffled(senior).slice(0, 10),
        ...shuffled(junior).slice(0, 6),
      ].map((u) => u.id);
    },
  },
  {
    title: "【テスト】バックステージ招待 抽選J（応募少なめ）",
    description: "応募8名、当選枠3名のミニ抽選。",
    winnersCount: 3,
    pickUserIds: (us) => shuffled(us).slice(0, 8).map((u) => u.id),
  },
];

async function main() {
  // 全ユーザーを取得（admin は対象外）
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      gender: true,
      joinedAt: true,
      createdAt: true,
    },
  });
  console.log(`# 利用可能なユーザー: ${users.length}名`);

  if (users.length < 5) {
    throw new Error(
      "応募者候補となるユーザーが少なすぎます（5名未満）。先にシードを流してください。",
    );
  }

  // 任意のイベント/商品を1件ずつ紐付ける（無くてもOK、見栄え用）
  const event = await prisma.event.findFirst({
    orderBy: { createdAt: "desc" },
  });
  const product = await prisma.product.findFirst({
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  // 応募開始: 7日前 / 応募締切: 1日前 / 購入期限: 30日後
  const entryStartAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const entryEndAt = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const purchaseDeadlineAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let created = 0;
  for (const sc of SCENARIOS) {
    const userIds = Array.from(new Set(sc.pickUserIds(users)));
    if (userIds.length === 0) {
      console.log(`  skip: ${sc.title} (応募者ゼロ)`);
      continue;
    }
    const lottery = await prisma.lottery.create({
      data: {
        title: sc.title,
        description: sc.description,
        eventId: event?.id ?? null,
        productId: product?.id ?? null,
        entryStartAt,
        entryEndAt,
        purchaseDeadlineAt,
        winnersCount: sc.winnersCount,
        status: "CLOSED",
      },
    });

    // 応募データ作成（応募日時はバラけさせる）
    const entries = userIds.map((uid, i) => ({
      lotteryId: lottery.id,
      userId: uid,
      status: "ENTERED" as const,
      // 締切前7日間に分散
      enteredAt: new Date(
        entryStartAt.getTime() +
          Math.floor((entryEndAt.getTime() - entryStartAt.getTime()) * (i / userIds.length)) +
          Math.floor(Math.random() * 60 * 60 * 1000),
      ),
    }));
    await prisma.lotteryEntry.createMany({
      data: entries,
      skipDuplicates: true,
    });

    console.log(
      `  ✓ ${sc.title}\n    枠 ${sc.winnersCount} / 応募 ${entries.length}名`,
    );
    created += 1;
  }

  console.log(`\n✅ ${created}件のテスト抽選を作成しました。`);
  console.log(`   /admin/lotteries で「【テスト】」始まりの行を開いてください。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
