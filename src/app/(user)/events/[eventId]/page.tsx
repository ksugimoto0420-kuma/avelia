import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { ProductCard } from "@/components/user/ProductCard";
import {
  EVENT_TYPE_COLOR,
  EVENT_TYPE_LABEL,
  SALE_METHOD_COLOR,
  SALE_METHOD_LABEL,
} from "@/lib/event-meta";
import { availableStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import {
  getSaleStatus,
  SALE_STATUS_COLOR,
  SALE_STATUS_LABEL,
} from "@/lib/sale";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getEvent(id: string) {
  return prisma.event.findFirst({
    where: { id, isPublished: true },
    include: {
      products: {
        where: { isPublished: true },
        include: { variants: { include: { inventory: true } } },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  const event = await getEvent(eventId);
  if (!event) return { title: "イベントが見つかりません" };
  return {
    title: event.title,
    description: event.description ?? undefined,
    openGraph: {
      title: event.title,
      description: event.description ?? undefined,
      images: event.coverImageUrl ? [event.coverImageUrl] : undefined,
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getEvent(eventId);
  if (!event) notFound();

  const status = getSaleStatus({
    isPublished: event.isPublished,
    saleStartAt: event.saleStartAt,
    saleEndAt: event.saleEndAt,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* カバー */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-100 to-brand-50">
        <div className="aspect-[21/9] w-full">
          {event.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.coverImageUrl}
              alt={event.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl font-black text-brand-300">
              {event.title}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge color={EVENT_TYPE_COLOR[event.eventType]}>
          {EVENT_TYPE_LABEL[event.eventType]}
        </Badge>
        <Badge color={SALE_METHOD_COLOR[event.saleMethod]}>
          {SALE_METHOD_LABEL[event.saleMethod]}販売
        </Badge>
        <Badge color={SALE_STATUS_COLOR[status]}>
          {SALE_STATUS_LABEL[status]}
        </Badge>
      </div>

      {event.artistName && (
        <p className="mt-4 text-sm font-bold text-brand-600">
          {event.artistName}
        </p>
      )}
      <h1 className="mt-1 text-3xl font-bold text-gray-900">{event.title}</h1>

      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm sm:grid-cols-2">
        {event.eventDate && (
          <div className="flex gap-2">
            <dt className="font-semibold text-gray-500">開催日時</dt>
            <dd className="text-gray-800">{formatDateTime(event.eventDate)}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="font-semibold text-gray-500">販売期間</dt>
          <dd className="text-gray-800">
            {formatDateTime(event.saleStartAt)} 〜 {formatDateTime(event.saleEndAt)}
          </dd>
        </div>
      </dl>

      {event.streamingUrl && (
        <section className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-brand-700">
              当日のライブ配信
            </p>
            <p className="mt-1 text-xs text-gray-600">
              視聴は任意です。視聴されなくても、ご購入のサイン入り商品は後日発送いたします。
            </p>
          </div>
          <a
            href={event.streamingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
          >
            配信ページを開く ↗
          </a>
        </section>
      )}

      {event.description && (
        <section className="mt-8">
          <h2 className="mb-3 border-l-4 border-brand-500 pl-3 text-lg font-bold text-gray-900">
            イベント内容
          </h2>
          <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
            {event.description}
          </p>
        </section>
      )}

      <h2 className="mb-5 mt-12 text-2xl font-bold text-gray-900">
        対象商品（券種一覧）
      </h2>
      {event.products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
          販売中の商品はまだありません
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {event.products.map((p) => {
            const available = p.variants.reduce(
              (s, v) => s + (v.inventory ? availableStock(v.inventory) : 0),
              0,
            );
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
                    isPublished: p.isPublished && event.isPublished,
                    saleStartAt: p.saleStartAt ?? event.saleStartAt,
                    saleEndAt: p.saleEndAt ?? event.saleEndAt,
                    available,
                  },
                }}
              />
            );
          })}
        </div>
      )}

      {event.notes && (
        <section className="mt-12">
          <h2 className="mb-3 border-l-4 border-red-400 pl-3 text-lg font-bold text-gray-900">
            注意事項
          </h2>
          <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {event.notes}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
