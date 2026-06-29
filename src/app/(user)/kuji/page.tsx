import Link from "next/link";
import { MediaImage } from "@/components/ui/MediaImage";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "アベリアくじ" };

/**
 * アベリアくじ一覧。sukisuki-shop.com/kuji を参考にした縦長カードグリッド。
 * - モバイル 1列 / SP-md 2列 / lg 3列
 * - カード上半分: 縦長バナー画像 + 左上にステータスバッジ
 * - カード下半分: アーティスト名 / タイトル / 販売期間 / お届け目安
 */
export default async function KujiListPage() {
  const now = new Date();
  const allCampaigns = await prisma.kujiCampaign.findMany({
    where: { status: { in: ["OPEN", "CLOSED"] } },
    orderBy: { saleEndAt: "desc" },
    include: {
      event: { select: { title: true, artistName: true } },
      artist: { select: { name: true } },
      _count: { select: { prizes: true } },
    },
    take: 60,
  });

  // 「販売中（saleStartAt..saleEndAt 内）」を上、それ以外を下に
  const onSale = allCampaigns.filter(
    (c) =>
      c.status === "OPEN" &&
      c.saleStartAt <= now &&
      now <= c.saleEndAt,
  );
  const ended = allCampaigns.filter((c) => !onSale.includes(c));
  const ordered = [...onSale, ...ended];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          アベリアくじ
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          オンラインで引けるくじです。1回ごとに即時抽選し、当選賞品は実品で後日配送いたします。
        </p>
      </div>

      {ordered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-400">
          現在表示できるくじはありません
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((c) => {
            const isOpen =
              c.status === "OPEN" &&
              c.saleStartAt <= now &&
              now <= c.saleEndAt;
            return (
              <li key={c.id}>
                <Link
                  href={`/kuji/${c.id}`}
                  className="group block overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* バナー画像（横長 16:9） */}
                  <div className="relative">
                    <MediaImage
                      src={c.bannerImageUrl}
                      alt={c.title}
                      aspect="16/9"
                    />
                    {/* ステータスバッジ */}
                    <div className="absolute left-3 top-3">
                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold shadow-sm " +
                          (isOpen
                            ? "bg-pink-600 text-white"
                            : "bg-gray-700/90 text-white")
                        }
                      >
                        {isOpen ? "販売中" : "終了"}
                        <span className="opacity-90">アベリアくじ</span>
                      </span>
                    </div>
                  </div>

                  {/* 情報部 */}
                  <div className="p-4">
                    <p className="text-xs text-gray-500">
                      {c.artist?.name ?? c.event?.artistName ?? ""}
                    </p>
                    <h2 className="mt-1 line-clamp-2 text-base font-bold text-gray-900 group-hover:text-pink-600">
                      {c.title}
                    </h2>
                    <div className="mt-2 space-y-0.5 text-xs text-gray-600">
                      <div className="flex gap-1.5">
                        <span className="shrink-0 text-gray-400">販売期間：</span>
                        <span>
                          {formatDateTime(c.saleStartAt)} 〜{" "}
                          {formatDateTime(c.saleEndAt)}
                        </span>
                      </div>
                      {c.deliveryNote && (
                        <div className="flex gap-1.5">
                          <span className="shrink-0 text-gray-400">
                            お届け目安：
                          </span>
                          <span>{c.deliveryNote}</span>
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <span className="shrink-0 text-gray-400">1回：</span>
                        <span className="font-bold text-pink-600">
                          {formatYen(c.pricePerDraw)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
