import { notFound } from "next/navigation";
import { LotteryForm } from "@/components/admin/LotteryForm";
import {
  LotteryDraftPanel,
  type Candidate,
} from "@/components/admin/LotteryDraftPanel";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { deleteLottery } from "../actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "抽選編集 | 管理" };

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

export default async function EditLotteryPage({
  params,
}: {
  params: Promise<{ lotteryId: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const { lotteryId } = await params;

  const [lottery, events, products, entries] = await Promise.all([
    prisma.lottery.findUnique({
      where: { id: lotteryId },
      include: { _count: { select: { entries: true } } },
    }),
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, artistName: true },
    }),
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, name: true, event: { select: { title: true } } },
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

  // 応募者の累計購入回数・累計購入額を集計（PAID/SHIPPED/COMPLETED 系を購入扱い）。
  // 抽選用候補テーブルに渡す。
  const candidateUserIds = entries
    .filter((e) => e.status === "ENTERED")
    .map((e) => e.userId);
  const orderAggregates = candidateUserIds.length
    ? await prisma.order.groupBy({
        by: ["userId"],
        where: {
          userId: { in: candidateUserIds },
          // 未払い・キャンセルは除外して「購入実績」とみなす
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
        Math.floor((now.getTime() - new Date(since).getTime()) / (1000 * 60 * 60 * 24)),
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

  // 抽選実行可否（クライアントへ理由も渡す）
  let drawBlockReason: string | null = null;
  if (lottery.status === "DRAFT") drawBlockReason = "下書きの抽選は実行できません。受付中に変更してください。";
  else if (lottery.status === "DRAWN") drawBlockReason = "既に抽選済みです。";
  else if (now < lottery.entryEndAt)
    drawBlockReason = `応募締切前は実行できません（締切: ${formatDateTime(lottery.entryEndAt)}）。`;
  else if (candidates.length === 0)
    drawBlockReason = "応募者がいないため実行できません。";
  const canDraw = drawBlockReason == null;

  const canDelete = lottery.status !== "DRAWN" && lottery._count.entries === 0;

  const winners = entries.filter(
    (e) => e.status === "WON" || e.status === "PURCHASED" || e.status === "EXPIRED",
  );
  const losers = entries.filter((e) => e.status === "LOST");
  const pending = entries.filter((e) => e.status === "ENTERED");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">抽選編集</h1>
      <LotteryForm
        initial={{
          id: lottery.id,
          title: lottery.title,
          description: lottery.description,
          eventId: lottery.eventId,
          productId: lottery.productId,
          entryStartAt: lottery.entryStartAt,
          entryEndAt: lottery.entryEndAt,
          purchaseDeadlineAt: lottery.purchaseDeadlineAt,
          winnersCount: lottery.winnersCount,
          status: lottery.status,
        }}
        events={events.map((e) => ({
          id: e.id,
          label: e.artistName ? `${e.artistName} / ${e.title}` : e.title,
        }))}
        products={products.map((p) => ({
          id: p.id,
          label: `${p.event.title} / ${p.name}`,
        }))}
      />

      {lottery.status !== "DRAWN" && (
        <Card>
          <CardHeader
            title="ハイブリッド抽選: 事前指名＋ガチ抽選"
            subtitle={`応募 ${entries.length} 名（抽選未実行）。事前指名した方は確定当選、残り枠はガチ抽選になります。`}
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

      {/* 抽選後（または応募確認用）の一覧。常時表示。 */}
      <Card>
        <CardHeader
          title="応募・当選者一覧"
          subtitle={
            lottery.status === "DRAWN"
              ? `応募 ${entries.length} 名 / 当選 ${winners.length} 名 / 落選 ${losers.length} 名`
              : `応募 ${entries.length} 名（抽選未実行）`
          }
        />
        <CardBody className="space-y-6">
          {entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
              まだ応募はありません
            </p>
          ) : (
            <>
              {lottery.status === "DRAWN" && winners.length > 0 && (
                <EntrySection
                  title="当選者"
                  rows={winners}
                />
              )}
              {lottery.status === "DRAWN" && losers.length > 0 && (
                <EntrySection
                  title="落選者"
                  rows={losers}
                />
              )}
              {pending.length > 0 && (
                <EntrySection
                  title={lottery.status === "DRAWN" ? "未判定" : "応募中"}
                  rows={pending}
                />
              )}
            </>
          )}
        </CardBody>
      </Card>

      <Card className="border-red-200">
        <CardHeader title="削除" />
        <CardBody className="space-y-3">
          {canDelete ? (
            <>
              <p className="text-sm text-gray-600">
                この抽選にはまだ応募がなく、抽選も実行されていません。削除できます。
              </p>
              <form action={deleteLottery}>
                <input type="hidden" name="id" value={lottery.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  この抽選を削除する
                </button>
              </form>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              {lottery.status === "DRAWN"
                ? "抽選実行済みのため削除できません。"
                : `${lottery._count.entries}件の応募があるため削除できません。`}
            </p>
          )}
        </CardBody>
      </Card>
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
              const conf = ENTRY_STATUS[e.status] ?? { label: e.status, color: "gray" as const };
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
                    {e.purchaseDeadlineAt ? formatDateTime(e.purchaseDeadlineAt) : "-"}
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
