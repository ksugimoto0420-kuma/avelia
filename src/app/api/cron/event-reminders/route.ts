import { env } from "@/lib/env";
import { sendTemplatedMail } from "@/lib/mail/resolveTemplate";
import { EventReminderMail } from "@/lib/mail/templates/EventReminderMail";
import { getSetting } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * イベント開催前日リマインダー (#43)。
 * Vercel Cron から毎日 09:00 JST に叩かれる想定。
 * 「今日+1日」に開催されるイベントの購入者にリマインドメールを送る。
 *
 * 冪等性: Resend 側の idempotencyKey で担保。同じキーの送信は重複扱い。
 * Vercel Hobby は 1日1回の cron 制限なので前日リマインドのみ実装。
 * 「開催3時間前」の通知は Pro プランに上げた時点で追加する。
 */

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

  // JST 基準で「明日 00:00 〜 24:00」に開催されるイベントを対象にする
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth();
  const d = jst.getUTCDate();
  // 明日 00:00 JST = UTC 15:00 (今日)
  const startUtc = new Date(Date.UTC(y, m, d + 1, 0, 0, 0) - 9 * 60 * 60 * 1000);
  const endUtc = new Date(Date.UTC(y, m, d + 2, 0, 0, 0) - 9 * 60 * 60 * 1000);

  const events = await prisma.event.findMany({
    where: {
      eventDate: { gte: startUtc, lt: endUtc },
      isPublished: true,
    },
    select: {
      id: true,
      title: true,
      eventDate: true,
      streamingUrl: true,
    },
  });

  let sentCount = 0;
  let skippedCount = 0;
  const failures: Array<{ orderId: string; reason: string }> = [];
  const siteName = await getSetting("siteName");

  for (const ev of events) {
    // このイベントに紐づく PAID 注文のユニークユーザーを取得
    const orders = await prisma.order.findMany({
      where: {
        status: "PAID",
        items: {
          some: { variant: { product: { eventId: ev.id } } },
        },
      },
      select: {
        id: true,
        orderNumber: true,
        user: { select: { email: true, name: true } },
      },
    });
    const eventDateLabel = ev.eventDate
      ? new Intl.DateTimeFormat("ja-JP", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Tokyo",
        }).format(ev.eventDate)
      : "";

    for (const order of orders) {
      if (!order.user.email) {
        skippedCount++;
        continue;
      }
      try {
        const orderUrl = `${env.appUrl}/mypage/orders/${order.id}`;
        await sendTemplatedMail({
          kind: "EVENT_REMINDER",
          to: order.user.email,
          variables: {
            siteName,
            userName: order.user.name ?? "",
            eventTitle: ev.title,
            eventDate: eventDateLabel,
            streamingUrl: ev.streamingUrl ?? "",
            orderUrl,
          },
          fallback: {
            subject: `【${siteName}】明日開催: ${ev.title}`,
            template: EventReminderMail({
              customerName: order.user.name,
              eventTitle: ev.title,
              eventDateLabel,
              streamingUrl: ev.streamingUrl,
              orderUrl,
            }),
          },
          // 同じイベント+注文+日付キーで一意 → 手動再実行しても重複送信されない
          idempotencyKey: `event-reminder:${ev.id}:${order.id}:${startUtc.toISOString().slice(0, 10)}`,
        });
        sentCount++;
      } catch (e) {
        failures.push({
          orderId: order.id,
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return new Response(
    JSON.stringify({
      scannedEvents: events.length,
      sent: sentCount,
      skipped: skippedCount,
      failures,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

export const POST = GET;
