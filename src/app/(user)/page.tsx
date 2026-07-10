import Link from "next/link";
import { EventCard, type EventCardData } from "@/components/user/EventCard";
import { HeroSlider } from "@/components/user/HeroSlider";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { eventStageOrderBy, eventStageWhere } from "@/lib/sale";
import { getHeroImages } from "@/lib/settings";

export const dynamic = "force-dynamic";

const PER_PAGE = 12;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const pageParam = Number(sp.page ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
  const now = new Date();

  // Phase 1 は特典会に特化。KUJI/GOODS/TRADING_CARD は非表示。
  const eventTypeFilter = { eventType: "MEET_GREET" as const };

  // 販売中 → 販売予定 → 終了 の順で全件を並べ、ページ内は12件。
  const [heroImages, onSale, upcoming, ended] = await Promise.all([
    getHeroImages(),
    prisma.event.findMany({
      where: { isPublished: true, ...eventTypeFilter, ...eventStageWhere("on_sale", now) },
      orderBy: eventStageOrderBy.on_sale,
    }),
    prisma.event.findMany({
      where: { isPublished: true, ...eventTypeFilter, ...eventStageWhere("upcoming", now) },
      orderBy: eventStageOrderBy.upcoming,
    }),
    prisma.event.findMany({
      where: { isPublished: true, ...eventTypeFilter, ...eventStageWhere("ended", now) },
      orderBy: eventStageOrderBy.ended,
    }),
  ]);
  const allEvents = [...onSale, ...upcoming, ...ended];
  const totalPages = Math.max(1, Math.ceil(allEvents.length / PER_PAGE));
  const clampedPage = Math.min(page, totalPages);
  const pageEvents = allEvents.slice(
    (clampedPage - 1) * PER_PAGE,
    clampedPage * PER_PAGE,
  );

  const cards: EventCardData[] = pageEvents.map((e) => ({
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
      {/* ヒーロー: 1枚なら静止、複数枚はスライダー */}
      <section className="bg-gray-100">
        <div className="mx-auto max-w-6xl">
          {heroImages.length > 0 ? (
            <HeroSlider images={heroImages} />
          ) : (
            <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-50 text-brand-600 md:aspect-[21/9]">
              <p className="text-sm">
                管理画面のサイト設定からヒーロー画像を登録してください
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        <section className="py-10">
          {cards.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
              公開中のイベントはまだありません
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav
                  aria-label="ページ切替"
                  className="mt-10 flex flex-wrap items-center justify-center gap-2 text-sm"
                >
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <Link
                        key={p}
                        href={p === 1 ? "/" : `/?page=${p}`}
                        className={cn(
                          "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3",
                          p === clampedPage
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                        )}
                      >
                        {p}
                      </Link>
                    ),
                  )}
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
