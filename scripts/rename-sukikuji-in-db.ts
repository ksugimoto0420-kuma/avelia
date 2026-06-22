/**
 * DB 上のテキストに残る「すきくじ」も「アベリアくじ」に置換する。
 * 対象: Event.title / Event.description / Product.name / Product.description /
 *      FAQ.question / FAQ.answer など。
 */
import { prisma } from "../src/lib/prisma";

const FROM = "すきくじ";
const TO = "アベリアくじ";

async function replaceInModel(label: string, count: () => Promise<number>, update: () => Promise<{ count: number }>) {
  const before = await count();
  if (before === 0) {
    console.log(`  ${label}: 対象なし`);
    return;
  }
  const r = await update();
  console.log(`  ${label}: ${before} 件のうち ${r.count} 件更新`);
}

async function main() {
  // raw SQL で REPLACE 一括
  const r1 = await prisma.$executeRaw`UPDATE "events" SET "title" = REPLACE("title", ${FROM}, ${TO}) WHERE "title" LIKE ${`%${FROM}%`}`;
  console.log(`Event.title: ${r1} 件`);

  const r2 = await prisma.$executeRaw`UPDATE "events" SET "description" = REPLACE("description", ${FROM}, ${TO}) WHERE "description" LIKE ${`%${FROM}%`}`;
  console.log(`Event.description: ${r2} 件`);

  const r3 = await prisma.$executeRaw`UPDATE "events" SET "notes" = REPLACE("notes", ${FROM}, ${TO}) WHERE "notes" LIKE ${`%${FROM}%`}`;
  console.log(`Event.notes: ${r3} 件`);

  const r4 = await prisma.$executeRaw`UPDATE "products" SET "name" = REPLACE("name", ${FROM}, ${TO}) WHERE "name" LIKE ${`%${FROM}%`}`;
  console.log(`Product.name: ${r4} 件`);

  const r5 = await prisma.$executeRaw`UPDATE "products" SET "description" = REPLACE("description", ${FROM}, ${TO}) WHERE "description" LIKE ${`%${FROM}%`}`;
  console.log(`Product.description: ${r5} 件`);

  const r6 = await prisma.$executeRaw`UPDATE "products" SET "benefit" = REPLACE("benefit", ${FROM}, ${TO}) WHERE "benefit" LIKE ${`%${FROM}%`}`;
  console.log(`Product.benefit: ${r6} 件`);

  const r7 = await prisma.$executeRaw`UPDATE "products" SET "notes" = REPLACE("notes", ${FROM}, ${TO}) WHERE "notes" LIKE ${`%${FROM}%`}`;
  console.log(`Product.notes: ${r7} 件`);

  const r8 = await prisma.$executeRaw`UPDATE "faqs" SET "question" = REPLACE("question", ${FROM}, ${TO}) WHERE "question" LIKE ${`%${FROM}%`}`;
  console.log(`Faq.question: ${r8} 件`);

  const r9 = await prisma.$executeRaw`UPDATE "faqs" SET "answer" = REPLACE("answer", ${FROM}, ${TO}) WHERE "answer" LIKE ${`%${FROM}%`}`;
  console.log(`Faq.answer: ${r9} 件`);

  const r10 = await prisma.$executeRaw`UPDATE "lotteries" SET "title" = REPLACE("title", ${FROM}, ${TO}) WHERE "title" LIKE ${`%${FROM}%`}`;
  console.log(`Lottery.title: ${r10} 件`);

  console.log("\n✅ done");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
