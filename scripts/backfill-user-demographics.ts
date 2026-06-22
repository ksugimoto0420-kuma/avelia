/**
 * 既存ユーザーに gender / joinedAt のダミー値を埋める。
 *
 * 抽選の事前指名フィルター（性別・会員年数）デモ用。
 * - email に fan01〜fan20 が含まれる「ファン」ユーザーには規則的に振り分け
 * - user@example.com は MALE / 3年前入会 で固定
 * - admin / 既に gender or joinedAt が入っているユーザーには触らない
 */
import { prisma } from "../src/lib/prisma";

const ROTATION: ("MALE" | "FEMALE" | "OTHER" | "UNDISCLOSED")[] = [
  "FEMALE",
  "FEMALE",
  "FEMALE",
  "MALE",
  "MALE",
  "OTHER",
  "UNDISCLOSED",
];

function pickGender(seed: number) {
  return ROTATION[seed % ROTATION.length];
}

function joinedAtFor(seed: number): Date {
  const days = 30 + seed * 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ gender: null }, { joinedAt: null }],
    },
    select: { id: true, email: true, gender: true, joinedAt: true, createdAt: true },
  });
  console.log(`# 対象ユーザー: ${users.length}件`);

  let i = 0;
  for (const u of users) {
    i += 1;
    // テスト太郎は固定
    let gender = u.gender;
    let joinedAt = u.joinedAt;
    if (u.email === "user@example.com") {
      gender ??= "MALE";
      joinedAt ??= new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
    } else {
      const m = u.email.match(/fan(\d+)/);
      const n = m ? Number(m[1]) : i;
      gender ??= pickGender(n);
      joinedAt ??= joinedAtFor(n);
    }
    await prisma.user.update({
      where: { id: u.id },
      data: { gender, joinedAt },
    });
    console.log(`  ${u.email} → ${gender} / ${joinedAt.toISOString().slice(0, 10)}`);
  }

  console.log("✅ done");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
