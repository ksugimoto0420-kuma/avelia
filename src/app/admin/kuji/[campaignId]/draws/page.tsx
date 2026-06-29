import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "アベリアくじ 抽選履歴" };

const PAGE_SIZE = 100;

export default async function KujiDrawsPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminPage("OPERATOR");
  const { campaignId } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1"));

  const [campaign, prizes, draws, total] = await Promise.all([
    prisma.kujiCampaign.findUnique({ where: { id: campaignId } }),
    prisma.kujiPrize.findMany({
      where: { campaignId },
      orderBy: { order: "asc" },
    }),
    prisma.kujiDraw.findMany({
      where: { campaignId },
      orderBy: { drawnAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { name: true, email: true } },
        prize: { select: { rank: true, name: true } },
        order: { select: { orderNumber: true, total: true } },
      },
    }),
    prisma.kujiDraw.count({ where: { campaignId } }),
  ]);
  if (!campaign) notFound();

  // 賞ごとの集計
  const summary = new Map<string, number>();
  for (const d of await prisma.kujiDraw.groupBy({
    by: ["prizeId"],
    where: { campaignId },
    _count: { _all: true },
  })) {
    summary.set(d.prizeId, d._count._all);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href={`/admin/kuji/${campaign.id}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← {campaign.title}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">
          抽選履歴 ({total})
        </h1>
      </div>

      <Card>
        <CardHeader title="賞別 排出集計" />
        <CardBody>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">ランク</th>
                  <th className="px-3 py-2 text-left">賞品名</th>
                  <th className="px-3 py-2 text-left">タイプ</th>
                  <th className="px-3 py-2 text-right">本数 / 残数</th>
                  <th className="px-3 py-2 text-right">排出回数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {prizes.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-medium">{p.rank}</td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-xs">
                      <Badge
                        color={p.type === "LIMITED" ? "purple" : "blue"}
                      >
                        {p.type === "LIMITED" ? "本数制" : "確率制"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-600">
                      {p.type === "LIMITED"
                        ? `${p.totalCount ?? 0} / ${p.remainingCount ?? 0}`
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {summary.get(p.id) ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`抽選履歴 ${total}件`} />
        <CardBody>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">引いた日時</th>
                  <th className="px-3 py-2 text-left">ユーザー</th>
                  <th className="px-3 py-2 text-left">注文番号</th>
                  <th className="px-3 py-2 text-right">注文金額</th>
                  <th className="px-3 py-2 text-left">当たった賞</th>
                  <th className="px-3 py-2 text-left">オマケ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {draws.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-gray-400"
                    >
                      抽選履歴がありません
                    </td>
                  </tr>
                ) : (
                  draws.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {formatDateTime(d.drawnAt)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <p>{d.user.name ?? "(名前未登録)"}</p>
                        <p className="text-gray-400">{d.user.email}</p>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link
                          href={`/admin/orders/${d.orderId}`}
                          className="text-brand-600 hover:underline"
                        >
                          {d.order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        {formatYen(d.order.total)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-bold">{d.prize.rank}</span>{" "}
                        <span className="text-gray-600">{d.prize.name}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {d.isBundleBonus && (
                          <Badge color="yellow">連数オマケ</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
