import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { MediaImage } from "@/components/ui/MediaImage";
import { requireUserPage } from "@/lib/auth/user-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "アベリアくじ履歴 | マイページ" };

/**
 * マイページ: アベリアくじ履歴。
 *
 * KujiDraw を Order 単位でグルーピングして「いつ・どのくじを・何連引いて・何が当たったか」を表示する。
 * デモ段階では Order が PAID 即確定なので、すべて「引き終わり」状態として並ぶ。
 * 本番化時は status が PAID の Order だけに絞ること（webhook 経由で抽選するため）。
 */
export default async function MypageKujiHistory() {
  const user = await requireUserPage("/mypage/kuji");

  const draws = await prisma.kujiDraw.findMany({
    where: { userId: user.id },
    orderBy: { drawnAt: "desc" },
    include: {
      campaign: { select: { id: true, title: true, bannerImageUrl: true } },
      order: {
        select: { id: true, orderNumber: true, total: true, createdAt: true },
      },
      prize: {
        select: {
          rank: true,
          name: true,
          imageUrl: true,
          variantNote: true,
          bundleOnly: true,
        },
      },
    },
  });

  // Order 単位（=「1回の購入」）でまとめる
  const byOrder = new Map<
    string,
    {
      orderId: string;
      orderNumber: string;
      total: number;
      drawnAt: Date;
      campaign: {
        id: string;
        title: string;
        bannerImageUrl: string | null;
      };
      draws: typeof draws;
    }
  >();
  for (const d of draws) {
    const key = d.orderId;
    const cur = byOrder.get(key);
    if (cur) {
      cur.draws.push(d);
    } else {
      byOrder.set(key, {
        orderId: d.orderId,
        orderNumber: d.order.orderNumber,
        total: d.order.total,
        drawnAt: d.drawnAt,
        campaign: d.campaign,
        draws: [d],
      });
    }
  }
  const groups = Array.from(byOrder.values()).sort(
    (a, b) => b.drawnAt.getTime() - a.drawnAt.getTime(),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/mypage"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← マイページ
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">
          アベリアくじ履歴
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          引いたアベリアくじの結果と注文情報を一覧できます。
          ※ 配送は当選賞品ごとに別途ご案内いたします。
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
          まだアベリアくじを引いていません
        </p>
      ) : (
        <ul className="space-y-5">
          {groups.map((g) => {
            // 賞ごとに集計
            const summary = new Map<
              string,
              { rank: string; name: string; count: number }
            >();
            for (const d of g.draws) {
              const key = `${d.prize.rank}|${d.prize.name}`;
              const cur = summary.get(key);
              if (cur) cur.count += 1;
              else
                summary.set(key, {
                  rank: d.prize.rank,
                  name: d.prize.name,
                  count: 1,
                });
            }
            const summaryArr = Array.from(summary.values()).sort((a, b) =>
              a.rank.localeCompare(b.rank),
            );
            const totalDraws = g.draws.length;
            const bonusCount = g.draws.filter((d) => d.isBundleBonus).length;

            return (
              <li
                key={g.orderId}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <div className="w-full shrink-0 sm:w-40">
                    <MediaImage
                      src={g.campaign.bannerImageUrl}
                      alt={g.campaign.title}
                      aspect="16/9"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color="pink">アベリアくじ</Badge>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(g.drawnAt)}
                      </span>
                    </div>
                    <h2 className="mt-1 text-base font-bold text-gray-900">
                      <Link
                        href={`/kuji/${g.campaign.id}`}
                        className="hover:text-pink-600"
                      >
                        {g.campaign.title}
                      </Link>
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      注文番号: {g.orderNumber} ／{" "}
                      引いた回数: <b>{totalDraws}</b>
                      {bonusCount > 0 && <>（うち連数オマケ {bonusCount}）</>} ／ 合計:{" "}
                      <b>{formatYen(g.total)}</b>
                    </p>
                    <ul className="mt-3 space-y-1 text-sm">
                      {summaryArr.map((s) => (
                        <li key={`${s.rank}-${s.name}`}>
                          <span className="font-bold text-pink-600">
                            {s.rank}賞
                          </span>{" "}
                          <span className="text-gray-700">{s.name}</span> ×{" "}
                          <b>{s.count}</b>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/kuji/${g.campaign.id}/result/${g.orderId}`}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        結果ページを開く
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
