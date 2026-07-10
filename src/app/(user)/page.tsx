import { EventCard, type EventCardData } from "@/components/user/EventCard";
import { prisma } from "@/lib/prisma";
import { eventStageOrderBy, eventStageWhere } from "@/lib/sale";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const now = new Date();

  // sukisuki 風のシンプル構成:
  //   1. ヒーロー画像 (管理画面から heroImageUrl を設定)
  //   2. イベント一覧のみ (販売中→販売予定 の順で最大 9 件)
  // 商品一覧・検索フォーム・登録CTA は削除。
  const [heroImageUrl, onSale, upcoming] = await Promise.all([
    getSetting("heroImageUrl"),
    prisma.event.findMany({
      where: {
        isPublished: true,
        eventType: { in: ["MEET_GREET", "TRADING_CARD"] },
        ...eventStageWhere("on_sale", now),
      },
      orderBy: eventStageOrderBy.on_sale,
      take: 9,
    }),
    prisma.event.findMany({
      where: {
        isPublished: true,
        eventType: { in: ["MEET_GREET", "TRADING_CARD"] },
        ...eventStageWhere("upcoming", now),
      },
      orderBy: eventStageOrderBy.upcoming,
      take: 9,
    }),
  ]);
  const events = [...onSale, ...upcoming].slice(0, 9);

  const eventCards: EventCardData[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    artistName: e.artistName,
    eventType: e.eventType,
    saleMethod: e.saleMethod,
    eventDate: e.eventDate,
    coverImageUrl: e.coverImageUrl,
    isPublished: e.isPublished,
    saleStartAt: e.saleStartAt,
    saleEndAt: e.saleEndAt,
  }));

  return (
    <div>
      {/* ヒーロー: 単一画像バナー */}
      <section className="bg-gray-100">
        <div className="mx-auto max-w-6xl">
          {heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImageUrl}
              alt=""
              className="block aspect-[16/9] w-full object-cover md:aspect-[21/9]"
            />
          ) : (
            <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-50 text-brand-600 md:aspect-[21/9]">
              <p className="text-sm">
                管理画面のサイト設定からヒーロー画像を設定してください
              </p>
            </div>
          )}
        </div>
      </section>

      {/* イベント一覧 */}
      <div className="mx-auto max-w-6xl px-4">
        <section className="py-10">
          {eventCards.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
              公開中のイベントはまだありません
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {eventCards.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
