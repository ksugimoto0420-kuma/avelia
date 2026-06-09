import type { EventType } from "@prisma/client";
import Link from "next/link";
import { EventCard, type EventCardData } from "@/components/user/EventCard";
import { EVENT_TYPE_LABEL } from "@/lib/event-meta";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type StatusFilter = "all" | "on_sale" | "upcoming" | "ended";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "on_sale", label: "販売中" },
  { key: "upcoming", label: "販売予定" },
  { key: "ended", label: "終了" },
];

const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "全種別" },
  { key: "MEET_GREET", label: EVENT_TYPE_LABEL.MEET_GREET },
  { key: "KUJI", label: EVENT_TYPE_LABEL.KUJI },
  { key: "TRADING_CARD", label: EVENT_TYPE_LABEL.TRADING_CARD },
  { key: "GOODS", label: EVENT_TYPE_LABEL.GOODS },
];

const VALID_TYPES = ["MEET_GREET", "KUJI", "TRADING_CARD", "GOODS"];

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; type?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const filter = (STATUS_FILTERS.find((f) => f.key === sp.filter)?.key ??
    "all") as StatusFilter;
  const type = sp.type && VALID_TYPES.includes(sp.type) ? sp.type : "";
  const q = (sp.q ?? "").trim();
  const now = new Date();

  const where: Record<string, unknown> = { isPublished: true };
  if (type) where.eventType = type as EventType;
  if (filter === "on_sale") {
    where.AND = [
      { OR: [{ saleStartAt: null }, { saleStartAt: { lte: now } }] },
      { OR: [{ saleEndAt: null }, { saleEndAt: { gte: now } }] },
    ];
  } else if (filter === "upcoming") {
    where.saleStartAt = { gt: now };
  } else if (filter === "ended") {
    where.saleEndAt = { lt: now };
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { artistName: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { saleStartAt: "asc" },
  });

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

  const heading = type ? EVENT_TYPE_LABEL[type as EventType] : "特典会・サイン会";
  const buildHref = (overrides: {
    type?: string;
    filter?: string;
    q?: string;
  }) => {
    const p = new URLSearchParams();
    const t = overrides.type ?? type;
    const f = overrides.filter ?? filter;
    const query = overrides.q ?? q;
    if (t) p.set("type", t);
    if (f && f !== "all") p.set("filter", f);
    if (query) p.set("q", query);
    const qs = p.toString();
    return qs ? `/events?${qs}` : "/events";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">{heading}</h1>

      {/* 検索 */}
      <form
        action="/events"
        method="get"
        className="mt-6 flex max-w-xl gap-2"
      >
        {type && <input type="hidden" name="type" value={type} />}
        {filter !== "all" && (
          <input type="hidden" name="filter" value={filter} />
        )}
        <input
          name="q"
          defaultValue={q}
          placeholder="アーティスト名・タイトルで検索"
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
        >
          検索
        </button>
        {q && (
          <Link
            href={buildHref({ q: "" })}
            className="flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            クリア
          </Link>
        )}
      </form>
      {q && (
        <p className="mt-2 text-xs text-gray-500">
          「{q}」の検索結果：{cards.length}件
        </p>
      )}

      {/* 種別 */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TYPE_FILTERS.map((t) => (
          <Link
            key={t.key || "all"}
            href={buildHref({ type: t.key })}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium",
              t.key === type
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* 販売状態 */}
      <div className="mt-3 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={buildHref({ filter: f.key })}
            className={cn(
              "rounded-full px-3 py-1 text-sm",
              f.key === filter
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:bg-gray-100",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {cards.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
          該当する特典会・商品がありません
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
