import { env } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

// しきい値以下の在庫を検出し、運営者にメール通知する。
// Vercel Cron で日次実行する想定。

export const runtime = "nodejs";

type LowRow = {
  variantId: string;
  sku: string;
  variantName: string;
  productName: string;
  eventTitle: string;
  available: number;
  lowStockThreshold: number;
};

function authorize(req: Request): boolean {
  const header = req.headers.get("authorization");
  if (header === `Bearer ${env.cronSecret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === env.cronSecret;
}

export async function GET(req: Request) {
  if (!env.cronSecret || !authorize(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 24時間以内に同条件で通知済みのものはスキップ（再送抑制）
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<LowRow[]>`
    SELECT pv.id AS "variantId", pv.sku, pv.name AS "variantName",
           p.name AS "productName", e.title AS "eventTitle",
           (i.quantity - i.reserved - i.sold) AS available,
           i."lowStockThreshold" AS "lowStockThreshold"
    FROM inventories i
    JOIN product_variants pv ON pv.id = i."variantId"
    JOIN products p ON p.id = pv."productId"
    JOIN events e ON e.id = p."eventId"
    WHERE i."lowStockThreshold" IS NOT NULL
      AND (i.quantity - i.reserved - i.sold) <= i."lowStockThreshold"
      AND p."isPublished" = true
      AND e."isPublished" = true
      AND (i."lowStockAlertedAt" IS NULL OR i."lowStockAlertedAt" < ${yesterday})
  `;

  if (rows.length === 0) {
    return new Response(
      JSON.stringify({ scanned: 0, alerted: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const recipients = env.alertEmailTo
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return new Response(
      JSON.stringify({
        scanned: rows.length,
        alerted: 0,
        skipped: "ALERT_EMAIL_TO not set",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const lines = rows
    .map(
      (r) =>
        `・[残${r.available}/閾値${r.lowStockThreshold}] ${r.eventTitle} / ${r.productName}（${r.variantName} / ${r.sku}）`,
    )
    .join("\n");

  const text = `以下の商品の在庫が設定された閾値を下回りました。

${lines}

管理画面で在庫を補充するか、商品を非公開に切り替えてください。
${env.appUrl}/admin/inventories?stock=low
`;

  for (const to of recipients) {
    await sendMail({
      to,
      subject: `【Avelia FunClub】低在庫アラート（${rows.length}件）`,
      text,
    });
  }

  // 通知済みフラグを立てる
  await prisma.inventory.updateMany({
    where: { variantId: { in: rows.map((r) => r.variantId) } },
    data: { lowStockAlertedAt: new Date() },
  });

  return new Response(
    JSON.stringify({
      scanned: rows.length,
      alerted: rows.length,
      recipients: recipients.length,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

export const POST = GET;
