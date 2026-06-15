import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";
import { getOptionalUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "抽選販売（すきくじ）" };

export default async function LotteriesListPage() {
  const user = await getOptionalUser();
  const now = new Date();

  const lotteries = await prisma.lottery.findMany({
    where: {
      status: { in: ["OPEN", "CLOSED", "DRAWN"] },
    },
    orderBy: { entryEndAt: "asc" },
    include: {
      event: {
        select: { title: true, artistName: true, coverImageUrl: true },
      },
      product: { select: { name: true, imageUrl: true, basePrice: true } },
      _count: { select: { entries: true } },
    },
    take: 60,
  });

  const myEntries = user
    ? await prisma.lotteryEntry.findMany({
        where: {
          userId: user.id,
          lotteryId: { in: lotteries.map((l) => l.id) },
        },
        select: { lotteryId: true, status: true },
      })
    : [];
  const entryMap = new Map(myEntries.map((e) => [e.lotteryId, e.status]));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">抽選販売（すきくじ）</h1>
      <p className="mt-2 text-sm text-gray-500">
        応募期間中の抽選にご応募いただけます。当選された方のみ、購入期限内に対象商品をご購入いただけます。
      </p>

      {lotteries.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
          現在公開中の抽選はありません
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {lotteries.map((l) => {
            const isOpen =
              l.status === "OPEN" && l.entryStartAt <= now && l.entryEndAt >= now;
            const myStatus = entryMap.get(l.id);
            // 対象商品の画像 → なければイベントカバー画像
            const imageUrl =
              l.product?.imageUrl ?? l.event?.coverImageUrl ?? null;
            return (
              <Card key={l.id} className="overflow-hidden">
                <Link href={`/lotteries/${l.id}`} className="block">
                  <MediaImage
                    src={imageUrl}
                    alt={l.title}
                    aspect="16/9"
                    fallback={l.title.slice(0, 2)}
                  />
                </Link>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {l.status === "OPEN" && isOpen && (
                      <Badge color="green">受付中</Badge>
                    )}
                    {l.status === "CLOSED" && <Badge color="yellow">締切</Badge>}
                    {l.status === "DRAWN" && (
                      <Badge color="purple">抽選済</Badge>
                    )}
                    {myStatus === "WON" && <Badge color="green">当選</Badge>}
                    {myStatus === "LOST" && <Badge color="gray">落選</Badge>}
                    {myStatus === "ENTERED" && (
                      <Badge color="blue">応募済</Badge>
                    )}
                  </div>
                  <Link
                    href={`/lotteries/${l.id}`}
                    className="block text-lg font-semibold text-gray-900 hover:text-brand-600"
                  >
                    {l.title}
                  </Link>
                  {l.event && (
                    <p className="text-xs text-gray-500">
                      {l.event.artistName ?? l.event.title}
                    </p>
                  )}
                  <dl className="space-y-1 text-xs text-gray-600">
                    <div>
                      <dt className="inline font-medium text-gray-500">
                        応募期間：
                      </dt>
                      <dd className="inline">
                        {formatDateTime(l.entryStartAt)} 〜{" "}
                        {formatDateTime(l.entryEndAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-gray-500">
                        当選者数：
                      </dt>
                      <dd className="inline">{l.winnersCount} 名</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-gray-500">
                        応募者数：
                      </dt>
                      <dd className="inline">{l._count.entries} 名</dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
