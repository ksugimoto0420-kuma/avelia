import { env } from "@/lib/env";
import { sendTemplatedMail } from "@/lib/mail/resolveTemplate";
import { LotteryLostMail } from "@/lib/mail/templates/LotteryLostMail";
import { LotteryWonMail } from "@/lib/mail/templates/LotteryWonMail";
import { getSetting } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export type LotteryMailResult = {
  wonSent: number;
  lostSent: number;
  skipped: number;
  failures: Array<{ entryId: string; email: string; reason: string }>;
};

/**
 * 抽選結果通知メール (#9) を全応募者に送信する。
 *
 * - `WON` に当選メール、`LOST` に落選メールを送る (PURCHASED は当選済み扱いで
 *   別途購入完了メールがあるため対象外)
 * - Resend の idempotencyKey に `${lotteryId}:${entryId}` を渡し、
 *   同じ抽選+応募の重複送信を防止
 * - 大量送信時の Resend レートリミット (2 req/s) を考慮し、
 *   1件ごとに 550ms スリープを挟んで直列送信する。
 *   Vercel Serverless の 60秒制限を跨ぐ規模になったら分割ジョブ化する。
 */
export async function sendLotteryResultMails(
  lotteryId: string,
): Promise<LotteryMailResult> {
  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: {
      event: { select: { title: true } },
      product: { select: { name: true, id: true } },
      entries: {
        where: { status: { in: ["WON", "LOST"] } },
        include: {
          user: { select: { email: true, name: true } },
        },
      },
    },
  });
  if (!lottery) {
    return { wonSent: 0, lostSent: 0, skipped: 0, failures: [] };
  }

  const result: LotteryMailResult = {
    wonSent: 0,
    lostSent: 0,
    skipped: 0,
    failures: [],
  };

  const purchaseDeadlineLabel = lottery.purchaseDeadlineAt
    ? new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
      }).format(lottery.purchaseDeadlineAt)
    : null;

  // 当選者は当選商品の購入ページ、落選者はマイページ抽選結果へ
  const purchaseUrl = lottery.product?.id
    ? `${env.appUrl}/products/${lottery.product.id}?lotteryId=${lottery.id}`
    : `${env.appUrl}/mypage/lottery-results`;
  const resultsUrl = `${env.appUrl}/mypage/lottery-results`;
  const siteName = await getSetting("siteName");

  for (const entry of lottery.entries) {
    if (!entry.user.email) {
      result.skipped++;
      continue;
    }
    try {
      if (entry.status === "WON") {
        await sendTemplatedMail({
          kind: "LOTTERY_WON",
          to: entry.user.email,
          variables: {
            siteName,
            userName: entry.user.name ?? "",
            lotteryTitle: lottery.title,
            eventTitle: lottery.event?.title ?? "",
            productName: lottery.product?.name ?? "",
            purchaseDeadline: purchaseDeadlineLabel ?? "",
            purchaseUrl,
          },
          fallback: {
            subject: `【${siteName}】「${lottery.title}」当選のお知らせ🎉`,
            template: LotteryWonMail({
              customerName: entry.user.name,
              lotteryTitle: lottery.title,
              productName: lottery.product?.name ?? null,
              eventTitle: lottery.event?.title ?? null,
              purchaseDeadlineLabel,
              purchaseUrl,
            }),
          },
          idempotencyKey: `lottery-won:${lottery.id}:${entry.id}`,
        });
        result.wonSent++;
      } else {
        await sendTemplatedMail({
          kind: "LOTTERY_LOST",
          to: entry.user.email,
          variables: {
            siteName,
            userName: entry.user.name ?? "",
            lotteryTitle: lottery.title,
            eventTitle: lottery.event?.title ?? "",
            resultsUrl,
          },
          fallback: {
            subject: `【${siteName}】「${lottery.title}」抽選結果のお知らせ`,
            template: LotteryLostMail({
              customerName: entry.user.name,
              lotteryTitle: lottery.title,
              eventTitle: lottery.event?.title ?? null,
              resultsUrl,
            }),
          },
          idempotencyKey: `lottery-lost:${lottery.id}:${entry.id}`,
        });
        result.lostSent++;
      }
    } catch (e) {
      result.failures.push({
        entryId: entry.id,
        email: entry.user.email,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
    // Resend の 2 req/s 制限に合わせて 550ms スリープ
    await sleep(550);
  }

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
