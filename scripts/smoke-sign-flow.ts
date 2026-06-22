/**
 * スモークテスト: PENDING → サイン記入 → WRITTEN → 承認 → READY → ユーザーDL までを
 * DB直接で再現し、各 API/ロジックの整合性を確認する。
 *
 * 実 API（/api/admin/signatures や approve action）は使わず、DB を直接更新し、
 * 期待される変化が起きるか確認するだけ。
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  // 任意の PENDING を 1 件取って一連を再現
  const d = await prisma.digitalDelivery.findFirst({
    where: { status: "PENDING" },
    include: { digitalContent: { select: { title: true, baseImageUrl: true } } },
  });
  if (!d) {
    console.log("PENDING がありません");
    return;
  }
  console.log(`対象: ${d.id} ${d.digitalContent.title} 宛=${d.nickname}`);
  console.log(`  原本URL: ${d.digitalContent.baseImageUrl ?? "(なし)"}`);

  // 1) サインを書いたことにする（dummy PNG）
  // 1x1 透過 PNG
  const dummyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  );

  const sig = await prisma.signature.upsert({
    where: { deliveryId: d.id },
    create: {
      deliveryId: d.id,
      imageData: dummyPng,
      status: "WRITTEN",
      writtenAt: new Date(),
    },
    update: {
      imageData: dummyPng,
      status: "WRITTEN",
      writtenAt: new Date(),
      rejectedAt: null,
      rejectReason: null,
    },
  });
  console.log(`✓ Signature WRITTEN sigId=${sig.id}`);

  // 2) 承認 → READY 化 + Signature.COMPLETED
  const now = new Date();
  const fileKey = `signature:${sig.id}`;
  await prisma.$transaction([
    prisma.signature.update({
      where: { id: sig.id },
      data: { status: "COMPLETED", composedAt: now },
    }),
    prisma.digitalDelivery.update({
      where: { id: d.id },
      data: {
        fileKey,
        originalFilename: `demo_${d.nickname ?? "宛名なし"}.png`,
        status: "READY",
        deliveredAt: now,
        expiresAt: new Date(now.getTime() + 365 * 86400 * 1000),
        downloadCount: 0,
      },
    }),
  ]);
  console.log(`✓ Delivery READY / fileKey=${fileKey}`);

  // 3) ユーザーDL条件チェック（READY + 期限内 + downloadCount < limit）
  const after = await prisma.digitalDelivery.findUnique({
    where: { id: d.id },
    include: {
      digitalContent: { select: { downloadLimit: true, viewLimitDays: true } },
    },
  });
  if (!after) return;
  const expiresOk = !after.expiresAt || after.expiresAt > new Date();
  const dlOk =
    after.digitalContent.downloadLimit == null ||
    after.downloadCount < after.digitalContent.downloadLimit;
  console.log(
    `  ユーザーDL可: ${after.status === "READY" && expiresOk && dlOk}`,
  );
  console.log(
    `    status=${after.status} expiresAt=${after.expiresAt?.toISOString() ?? "null"} downloadCount=${after.downloadCount} limit=${after.digitalContent.downloadLimit}`,
  );

  // 元の状態に戻す（このスモークテスト分のみ）
  await prisma.$transaction([
    prisma.signature.delete({ where: { id: sig.id } }),
    prisma.digitalDelivery.update({
      where: { id: d.id },
      data: {
        status: "PENDING",
        fileKey: null,
        originalFilename: null,
        deliveredAt: null,
        expiresAt: null,
        downloadCount: 0,
      },
    }),
  ]);
  console.log("✓ スモークテスト終了、対象 delivery を元に戻した");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
