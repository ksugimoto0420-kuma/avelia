import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { MediaImage } from "@/components/ui/MediaImage";
import { ProductCard } from "@/components/user/ProductCard";
import { getOptionalUser } from "@/lib/auth/guards";
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
      artist: {
        select: { id: true, slug: true, name: true, isPublished: true },
      },
      lotteries: {
        where: { status: { in: ["OPEN", "CLOSED", "DRAWN"] } },
        orderBy: [{ status: "asc" }, { entryEndAt: "desc" }],
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

  // 配信URL閲覧の権限：このイベントに紐づく商品をPAID注文しているユーザーのみ
  const user = await getOptionalUser();
  const hasPurchasedThisEvent = user
    ? (await prisma.order.count({
        where: {
          userId: user.id,
          status: "PAID",
          items: { some: { variant: { product: { eventId } } } },
        },
      })) > 0
    : false;

  const status = getSaleStatus({
    isPublished: event.isPublished,
    saleStartAt: event.saleStartAt,
    saleEndAt: event.saleEndAt,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* カバー */}
      <div className="overflow-hidden rounded-3xl">
        <MediaImage
          src={event.coverImageUrl}
          alt={event.title}
          aspect="16/9"
          fallback={event.title}
        />
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

      {(event.artist?.isPublished || event.artistName) && (
        <p className="mt-4 text-sm font-bold text-brand-600">
          {event.artist?.isPublished ? (
            <Link
              href={`/artists/${event.artist.slug}`}
              className="hover:underline"
            >
              {event.artist.name}
            </Link>
          ) : (
            event.artistName
          )}
        </p>
      )}
      <h1 className="mt-1 text-3xl font-bold text-gray-900">{event.title}</h1>

      {(() => {
        // 参加枠（定員）の残り計算：全商品バリアントの reserved+sold 合計を引く
        if (event.capacity == null) return null;
        const used = event.products.reduce(
          (s, p) =>
            s +
            p.variants.reduce(
              (sv, v) =>
                sv + (v.inventory ? v.inventory.reserved + v.inventory.sold : 0),
              0,
            ),
          0,
        );
        const remaining = Math.max(0, event.capacity - used);
        const ratio = remaining / event.capacity;
        const color =
          remaining === 0
            ? "red"
            : ratio < 0.2
              ? "yellow"
              : "green";
        const colorCls =
          color === "red"
            ? "border-red-200 bg-red-50 text-red-700"
            : color === "yellow"
              ? "border-yellow-200 bg-yellow-50 text-yellow-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-700";
        return (
          <div
            className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm ${colorCls}`}
          >
            <span className="font-medium">参加枠（定員）</span>
            <span>
              残り <b>{remaining}</b> / {event.capacity} 名
            </span>
          </div>
        );
      })()}

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

      {/* 抽選CTA */}
      {(() => {
        const now2 = new Date();
        // イベント全体抽選（productId=null かつ eventId一致）
        const eventLevelLottery = event.lotteries.find((l) => !l.productId);
        // 商品ごとの抽選
        const productLevelLotteries = event.lotteries.filter((l) => l.productId);

        if (eventLevelLottery) {
          // イベント全体で1つの抽選があるパターン
          const openNow =
            eventLevelLottery.status === "OPEN" &&
            eventLevelLottery.entryStartAt <= now2 &&
            eventLevelLottery.entryEndAt >= now2;
          return (
            <section className="mt-6 rounded-xl border-2 border-brand-300 bg-brand-50 p-5 text-center">
              <p className="text-sm font-bold text-brand-700">
                このイベントは抽選販売です
              </p>
              <p className="mt-1 text-xs text-gray-600">
                当選された方のみ、対象商品を購入いただけます。
                <br />
                応募締切：<b>{formatDateTime(eventLevelLottery.entryEndAt)}</b>
              </p>
              {openNow ? (
                <Link
                  href={`/lotteries/${eventLevelLottery.id}`}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-bold text-white hover:bg-brand-700"
                >
                  抽選詳細を見る →
                </Link>
              ) : (
                <p className="mt-2 text-xs text-gray-500">
                  {eventLevelLottery.status === "DRAWN"
                    ? "抽選は完了しました。マイページの「抽選結果」をご確認ください"
                    : "応募期間外です"}
                </p>
              )}
            </section>
          );
        }

        if (productLevelLotteries.length > 0) {
          // 商品ごとに別々の抽選があるパターン（sukisuki型）
          return (
            <section className="mt-6 rounded-xl border-2 border-brand-300 bg-brand-50 p-5">
              <p className="text-center text-sm font-bold text-brand-700">
                このイベントは商品ごとの抽選販売です
              </p>
              <p className="mt-2 text-center text-xs text-gray-600">
                ご希望の商品の <b>各商品ページ</b> から抽選にご応募ください。
                商品ごとに当選者のみがその商品を購入できます。
              </p>
              <p className="mt-1 text-center text-xs text-gray-500">
                抽選数：{productLevelLotteries.length} 件
              </p>
            </section>
          );
        }

        return null;
      })()}

      {event.streamingUrl &&
        (hasPurchasedThisEvent ? (
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
        ) : (
          <section className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <p className="font-bold text-gray-700">
              🔒 当日のライブ配信URLは購入者限定で表示されます
            </p>
            <p className="mt-1 text-xs text-gray-500">
              配信視聴は任意ですが、商品を購入された方のみ視聴URLが表示されます。
              {!user && (
                <>
                  {" "}
                  <Link
                    href={`/auth/login?callbackUrl=/events/${event.id}`}
                    className="text-brand-600 underline"
                  >
                    ログイン
                  </Link>
                  もご確認ください。
                </>
              )}
            </p>
          </section>
        ))}

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
