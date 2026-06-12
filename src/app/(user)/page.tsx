import Link from "next/link";
import { EventCard, type EventCardData } from "@/components/user/EventCard";
import { ProductCard } from "@/components/user/ProductCard";
import { availableStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { eventStageOrderBy, eventStageWhere } from "@/lib/sale";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const now = new Date();

  // 「販売中（終了が近い順）→ 販売予定（開始が近い順）→ 終了」の順で
  // 合計6件取る。各ステージから最大6件ずつ取って必要なだけ連結。
  const [onSale, upcoming, products] = await Promise.all([
    prisma.event.findMany({
      where: { isPublished: true, ...eventStageWhere("on_sale", now) },
      orderBy: eventStageOrderBy.on_sale,
      take: 6,
    }),
    prisma.event.findMany({
      where: { isPublished: true, ...eventStageWhere("upcoming", now) },
      orderBy: eventStageOrderBy.upcoming,
      take: 6,
    }),
    prisma.product.findMany({
      where: { isPublished: true, event: { isPublished: true } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        event: true,
        variants: { include: { inventory: true } },
      },
    }),
  ]);
  const events = [...onSale, ...upcoming].slice(0, 6);

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
      {/* ヒーロー */}
      <section className="bg-gradient-to-br from-brand-600 to-brand-400 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-100">
            Online Meet &amp; Greet Store
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-extrabold leading-tight md:text-5xl">
            推しと話せる、サインがもらえる。
            <br />
            オンライン特典会・サイン会ショップ。
          </h1>
          <p className="mt-4 max-w-xl text-brand-50">
            オンライン特典会・サイン会の参加券、直筆サイン入りポスター・写真集、
            すきくじ（抽選）やトレカまで。先着・抽選に対応したファン向けショップです。
          </p>
          <form
            action="/events"
            method="get"
            className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row"
          >
            <input
              name="q"
              placeholder="アーティスト名・タイトルで検索"
              className="flex-1 rounded-lg border-0 bg-white/95 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-bold text-white hover:bg-gray-800"
            >
              検索
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/events"
              className="inline-flex h-12 items-center rounded-lg bg-gray-900 px-6 text-base font-medium text-white hover:bg-gray-800"
            >
              特典会・サイン会を見る
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex h-12 items-center rounded-lg border-2 border-white bg-white/10 px-6 text-base font-medium text-white backdrop-blur hover:bg-white hover:text-brand-600"
            >
              新規登録
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* 注目イベント */}
        <section className="py-12">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              開催中・近日開催の特典会
            </h2>
            <Link
              href="/events"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              すべて見る →
            </Link>
          </div>
          {eventCards.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
              公開中の特典会はまだありません
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {eventCards.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </section>

        {/* 販売中商品 */}
        <section id="products" className="py-12">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            販売中の券種・商品
          </h2>
          {products.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
              販売中の商品はまだありません
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {products.map((p) => {
                const available = p.variants.reduce(
                  (s, v) => s + (v.inventory ? availableStock(v.inventory) : 0),
                  0,
                );
                const saleStartAt = p.saleStartAt ?? p.event.saleStartAt;
                const saleEndAt = p.saleEndAt ?? p.event.saleEndAt;
                return (
                  <ProductCard
                    key={p.id}
                    product={{
                      id: p.id,
                      name: p.name,
                      imageUrl: p.imageUrl,
                      basePrice: p.basePrice,
                      type: p.type,
                      benefit: p.benefit,
                      deliveryDate: p.deliveryDate,
                      sale: {
                        isPublished: p.isPublished && p.event.isPublished,
                        saleStartAt,
                        saleEndAt,
                        available,
                      },
                    }}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
