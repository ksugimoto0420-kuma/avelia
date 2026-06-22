import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LotteryDraftPanel,
  type Candidate,
} from "@/components/admin/LotteryDraftPanel";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "抽選実施 | 管理" };

const ENTRY_STATUS: Record<
  string,
  { label: string; color: "yellow" | "green" | "gray" | "purple" | "red" }
> = {
  ENTERED: { label: "応募中", color: "yellow" },
  WON: { label: "当選", color: "green" },
  LOST: { label: "落選", color: "gray" },
  PURCHASED: { label: "購入済", color: "purple" },
  EXPIRED: { label: "期限切れ", color: "red" },
};

/**
 * 抽選「実施」ページ。
 * 編集 (/admin/lotteries/[id]) と分離し、運営作業のフローを独立させる。
 *
 * 構成:
 *   - 抽選未実施: LotteryDraftPanel（指名 + ハイブリッド抽選）
 *   - 抽選実施済: 結果サマリ + 当選者/落選者の一覧表示
 *   - 両ケースとも応募者一覧（指名状況を含む）を最下部に表示
 */
export default async function DrawLotteryPage({
  params,
}: {
  params: Promise<{ lotteryId: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const { lotteryId } = await params;

  const [lottery, entries] = await Promise.all([
    prisma.lottery.findUnique({
      where: { id: lotteryId },
      include: {
        product: { select: { name: true } },
        event: { select: { title: true, artistName: true } },
      },
    }),
    prisma.lotteryEntry.findMany({
      where: { lotteryId },
      orderBy: [{ status: "asc" }, { enteredAt: "asc" }],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            gender: true,
            joinedAt: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);
  if (!lottery) notFound();

  // 応募者の購入実績集計
  const candidateUserIds = entries
    .filter((e) => e.status === "ENTERED")
    .map((e) => e.userId);
  const orderAggregates = candidateUserIds.length
    ? await prisma.order.groupBy({
        by: ["userId"],
        where: {
          userId: { in: candidateUserIds },
          paidAt: { not: null },
        },
        _count: { _all: true },
        _sum: { total: true },
      })
    : [];
  const aggByUserId = new Map<string, { count: number; sum: number }>();
  for (const a of orderAggregates) {
    aggByUserId.set(a.userId, {
      count: a._count._all,
      sum: a._sum.total ?? 0,
    });
  }

  const now = new Date();
  const candidates: Candidate[] = entries
    .filter((e) => e.status === "ENTERED")
    .map((e) => {
      const since = e.user.joinedAt ?? e.user.createdAt;
      const membershipDays = Math.max(
        0,
        Math.floor(
          (now.getTime() - new Date(since).getTime()) / (1000 * 60 * 60 * 24),
        ),
      );
      const agg = aggByUserId.get(e.userId);
      return {
        entryId: e.id,
        user: {
          id: e.user.id,
          name: e.user.name,
          email: e.user.email,
          gender: e.user.gender,
          joinedAt: e.user.joinedAt ? e.user.joinedAt.toISOString() : null,
        },
        enteredAt: e.enteredAt.toISOString(),
        orderCount: agg?.count ?? 0,
        totalSpent: agg?.sum ?? 0,
        membershipDays,
        pinned: e.pinned,
        pinReason: e.pinReason,
      };
    });

  // 抽選実行可否
  let drawBlockReason: string | null = null;
  if (lottery.status === "DRAFT")
    drawBlockReason =
      "下書きの抽選は実行できません。先に編集画面で「受付中」に変更してください。";
  else if (lottery.status === "DRAWN") drawBlockReason = "既に抽選済みです。";
  else if (now < lottery.entryEndAt)
    drawBlockReason = `応募締切前は実行できません（締切: ${formatDateTime(lottery.entryEndAt)}）。`;
  else if (candidates.length === 0)
    drawBlockReason = "応募者がいないため実行できません。";
  const canDraw = drawBlockReason == null;

  const winners = entries.filter(
    (e) =>
      e.status === "WON" || e.status === "PURCHASED" || e.status === "EXPIRED",
  );
  const losers = entries.filter((e) => e.status === "LOST");
  const pending = entries.filter((e) => e.status === "ENTERED");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/lotteries"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← 抽選一覧
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            抽選実施: {lottery.title}
          </h1>
          <p className="text-sm text-gray-500">
            対象商品: {lottery.product?.name ?? "-"} /{" "}
            {lottery.event?.artistName ?? lottery.event?.title ?? ""}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            応募期間: {formatDateTime(lottery.entryStartAt)} 〜{" "}
            {formatDateTime(lottery.entryEndAt)} / 当選枠:{" "}
            <b>{lottery.winnersCount}</b>名
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge kind="lottery" status={lottery.status} />
          <Link
            href={`/admin/lotteries/${lottery.id}`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            編集画面へ
          </Link>
        </div>
      </div>

      {/* 抽選未実施: 指名 + ガチ抽選パネル */}
      {lottery.status !== "DRAWN" && (
        <Card>
          <CardHeader
            title="ハイブリッド抽選（指名 + ガチ抽選）"
            subtitle={`応募 ${entries.length} 名。事前指名した方は確定当選、残り枠はガチ抽選になります。`}
          />
          <CardBody>
            {candidates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
                まだ応募中の候補がいません
              </p>
            ) : (
              <LotteryDraftPanel
                lotteryId={lottery.id}
                lotteryTitle={lottery.title}
                winnersCount={lottery.winnersCount}
                canDraw={canDraw}
                drawBlockReason={drawBlockReason}
                candidates={candidates}
              />
            )}
          </CardBody>
        </Card>
      )}

      {/* 抽選結果（DRAWN のみ） */}
      {lottery.status === "DRAWN" && (
        <Card>
          <CardHeader
            title="抽選結果"
            subtitle={`実施日時: ${lottery.drawAt ? formatDateTime(lottery.drawAt) : "-"} / 当選 ${winners.length}名 / 落選 ${losers.length}名`}
          />
          <CardBody className="space-y-6">
            {winners.length > 0 && (
              <EntrySection title="当選者" rows={winners} />
            )}
            {losers.length > 0 && (
              <EntrySection title="落選者" rows={losers} />
            )}
          </CardBody>
        </Card>
      )}

      {/* 応募者一覧（未抽選なら応募中、抽選済なら未判定が残っていれば） */}
      {lottery.status !== "DRAWN" && pending.length > 0 && (
        <Card>
          <CardHeader
            title="応募者一覧"
            subtitle={`${pending.length} 名（指名状況含む）`}
          />
          <CardBody>
            <EntrySection title="応募中" rows={pending} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

type EntryRow = {
  id: string;
  status: string;
  enteredAt: Date;
  wonAt: Date | null;
  purchaseDeadlineAt: Date | null;
  orderId: string | null;
  pinned: boolean;
  pinReason: string | null;
  user: { id: string; name: string | null; email: string };
};

function EntrySection({ title, rows }: { title: string; rows: EntryRow[] }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-bold text-gray-700">
        {title}（{rows.length} 名）
      </h4>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">ユーザー</th>
              <th className="px-3 py-2 text-left">状態</th>
              <th className="px-3 py-2 text-left">指名</th>
              <th className="px-3 py-2 text-left">応募日時</th>
              <th className="px-3 py-2 text-left">当選日時</th>
              <th className="px-3 py-2 text-left">購入期限</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((e) => {
              const conf = ENTRY_STATUS[e.status] ?? {
                label: e.status,
                color: "gray" as const,
              };
              return (
                <tr key={e.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900">
                      {e.user.name ?? "(名前未登録)"}
                    </p>
                    <p className="text-xs text-gray-500">{e.user.email}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={conf.color}>{conf.label}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {e.pinned ? (
                      <Badge color="yellow">
                        指名{e.pinReason ? `: ${e.pinReason}` : ""}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {formatDateTime(e.enteredAt)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {e.wonAt ? formatDateTime(e.wonAt) : "-"}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {e.purchaseDeadlineAt
                      ? formatDateTime(e.purchaseDeadlineAt)
                      : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
