import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "アベリアくじ" };

export default async function KujiListPage() {
  const now = new Date();
  const campaigns = await prisma.kujiCampaign.findMany({
    where: {
      status: "OPEN",
      saleStartAt: { lte: now },
      saleEndAt: { gte: now },
    },
    orderBy: { saleEndAt: "asc" },
    include: {
      event: { select: { title: true, artistName: true } },
      artist: { select: { name: true } },
      _count: { select: { prizes: true, draws: true } },
    },
    take: 60,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">アベリアくじ</h1>
      <p className="mt-2 text-sm text-gray-500">
        オンラインガチャ。1回ごとに即時抽選し、当選賞品は実品で後日配送いたします。
      </p>

      {campaigns.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-gray-300 py-12 text-center text-gray-400">
          現在販売中のくじはありません
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link href={`/kuji/${c.id}`}>
                <Card className="cursor-pointer transition hover:shadow-md">
                  <MediaImage
                    src={c.bannerImageUrl}
                    alt={c.title}
                    aspect="16/9"
                  />
                  <CardBody>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color="pink">アベリアくじ</Badge>
                      <Badge color="green">販売中</Badge>
                    </div>
                    <h2 className="mt-2 text-lg font-bold text-gray-900">
                      {c.title}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {c.artist?.name ?? c.event?.artistName ?? ""}
                      {c.event?.title ? ` / ${c.event.title}` : ""}
                    </p>
                    <p className="mt-2 text-sm text-gray-700">
                      1回 <b>{formatYen(c.pricePerDraw)}</b> ／ 賞{" "}
                      {c._count.prizes}種
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      販売終了: {formatDateTime(c.saleEndAt)}
                    </p>
                  </CardBody>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
