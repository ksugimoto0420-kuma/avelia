import type { EventType } from "@prisma/client";
import Link from "next/link";
import { EventCard, type EventCardData } from "@/components/user/EventCard";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { eventStageOrderBy, eventStageWhere } from "@/lib/sale";

export const dynamic = "force-dynamic";

// sukisuki 風のシンプル絞り込み: 全て / オンライン特典会 / トレカ のみ。
// アベリアくじ(KUJI)、GOODS は Phase 1 では表示対象外。
type CategoryTab = "all" | "meet_greet" | "trading_card";

const CATEGORY_TABS: { key: CategoryTab; label: string }[] = [
  { key: "all", label: "全て" },
  { key: "meet_greet", label: "オンライン特典会" },
  { key: "trading_card", label: "トレカ" },
];

const CATEGORY_TO_EVENT_TYPES: Record<CategoryTab, EventType[]> = {
  all: ["MEET_GREET", "TRADING_CARD"],
  meet_greet: ["MEET_GREET"],
  trading_card: ["TRADING_CARD"],
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab: CategoryTab =
    CATEGORY_TABS.find((t) => t.key === sp.tab)?.key ?? "all";
  const eventTypes = CATEGORY_TO_EVENT_TYPES[tab];
  const now = new Date();

  // 販売中 → 販売予定 → 終了 の順で連結して並べる。
  async function fetchStage(stage: "on_sale" | "upcoming" | "ended") {
    return prisma.event.findMany({
      where: {
        isPublished: true,
        eventType: { in: eventTypes },
        ...eventStageWhere(stage, now),
      },
      orderBy: eventStageOrderBy[stage],
    });
  }
  const [onSale, upcoming, ended] = await Promise.all([
    fetchStage("on_sale"),
    fetchStage("upcoming"),
    fetchStage("ended"),
  ]);
  const events = [...onSale, ...upcoming, ...ended];

  const cards: EventCardData[] = events.map((e) => ({
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

  const buildHref = (t: CategoryTab) =>
    t === "all" ? "/events" : `/events?tab=${t}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* カテゴリタブ (sukisuki 風のピル型ボタン) */}
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORY_TABS.map((t) => (
          <Link
            key={t.key}
            href={buildHref(t.key)}
            className={cn(
              "rounded-full border px-6 py-2 text-sm font-medium transition",
              t.key === tab
                ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                : "border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {cards.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
          該当するイベントがありません
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
