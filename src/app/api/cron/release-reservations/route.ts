import { env } from "@/lib/env";
import { releaseOrder } from "@/lib/order-status";
import { prisma } from "@/lib/prisma";

// Vercel Cron 等から定期実行する想定（仕様書 17）。
// 仮確保期限を過ぎた PENDING 注文を解放する。

export const runtime = "nodejs";

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

  const now = new Date();
  const expired = await prisma.order.findMany({
    where: { status: "PENDING", reservationExpiresAt: { lt: now } },
    select: { id: true },
    take: 200,
  });

  let released = 0;
  for (const o of expired) {
    const result = await releaseOrder({
      orderId: o.id,
      orderStatus: "CANCELLED",
      paymentStatus: "CANCELLED",
      reason: "reservation_expired",
      now,
    });
    if (result.changed) released++;
  }

  return new Response(
    JSON.stringify({ scanned: expired.length, released }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

export const POST = GET;
