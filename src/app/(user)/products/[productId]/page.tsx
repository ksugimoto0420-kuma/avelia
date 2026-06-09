import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { AddToCart } from "@/components/user/AddToCart";
import { SALE_METHOD_COLOR, SALE_METHOD_LABEL } from "@/lib/event-meta";
import { availableStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import {
  getSaleStatus,
  SALE_STATUS_COLOR,
  SALE_STATUS_LABEL,
} from "@/lib/sale";
import { formatDateTime, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getProduct(id: string) {
  return prisma.product.findFirst({
    where: { id, isPublished: true },
    include: {
      event: true,
      variants: { include: { inventory: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>;
}): Promise<Metadata> {
  const { productId } = await params;
  const p = await getProduct(productId);
  if (!p) return { title: "商品が見つかりません" };
  return {
    title: p.name,
    description: p.description ?? undefined,
    openGraph: {
      title: p.name,
      images: p.imageUrl ? [p.imageUrl] : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const p = await getProduct(productId);
  if (!p) notFound();

  const saleStartAt = p.saleStartAt ?? p.event.saleStartAt;
  const saleEndAt = p.saleEndAt ?? p.event.saleEndAt;
  const totalAvailable = p.variants.reduce(
    (s, v) => s + (v.inventory ? availableStock(v.inventory) : 0),
    0,
  );
  const status = getSaleStatus({
    isPublished: p.isPublished && p.event.isPublished,
    saleStartAt,
    saleEndAt,
    available: totalAvailable,
  });

  const variantOptions = p.variants.map((v) => ({
    id: v.id,
    name: v.name,
    price: v.price,
    available: v.inventory ? availableStock(v.inventory) : 0,
    requiresNickname: v.requiresNickname,
  }));
  // いずれかのSKUがニックネーム必須なら案内セクションを表示
  const anyNickname = p.variants.some((v) => v.requiresNickname);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/events" className="hover:text-brand-600">
          イベント
        </Link>
        {" / "}
        <Link
          href={`/events/${p.eventId}`}
          className="hover:text-brand-600"
        >
          {p.event.title}
        </Link>
      </nav>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* 画像 */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
          <div className="aspect-square w-full">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.imageUrl}
                alt={p.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl text-gray-300">
                🎁
              </div>
            )}
          </div>
        </div>

        {/* 情報 */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={SALE_METHOD_COLOR[p.event.saleMethod]}>
              {SALE_METHOD_LABEL[p.event.saleMethod]}販売
            </Badge>
            <Badge color={SALE_STATUS_COLOR[status]}>
              {SALE_STATUS_LABEL[status]}
            </Badge>
            {p.type === "DIGITAL" && <Badge color="purple">デジタル</Badge>}
            {p.lotteryOnly && <Badge color="pink">当選者限定</Badge>}
          </div>

          {p.event.artistName && (
            <p className="mt-3 text-sm font-bold text-brand-600">
              {p.event.artistName}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{p.name}</h1>

          {p.benefit && (
            <div className="mt-3 inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700">
              ✦ 特典: {p.benefit}
            </div>
          )}

          <p className="mt-4 text-3xl font-extrabold text-gray-900">
            {formatYen(p.basePrice)}
          </p>

          <dl className="mt-3 space-y-1 text-sm text-gray-500">
            <div className="flex gap-2">
              <dt className="font-medium">販売期間</dt>
              <dd>
                {formatDateTime(saleStartAt)} 〜 {formatDateTime(saleEndAt)}
              </dd>
            </div>
            {p.event.eventDate && (
              <div className="flex gap-2">
                <dt className="font-medium">開催日時</dt>
                <dd>{formatDateTime(p.event.eventDate)}</dd>
              </div>
            )}
            {p.deliveryDate && (
              <div className="flex gap-2">
                <dt className="font-medium">配信予定日</dt>
                <dd>{formatDateTime(p.deliveryDate)}</dd>
              </div>
            )}
          </dl>

          <div className="mt-6">
            <AddToCart
              variants={variantOptions}
              purchasable={status === "ON_SALE"}
              maxPerOrder={p.maxPerOrder}
              nicknameNote={p.nicknameNote}
            />
            <p className="mt-2 text-center text-xs text-gray-400">
              {p.lotteryOnly ? "抽選当選者のみ購入可" : "誰でも購入可"} ／
              ※購入にはログインが必要です
            </p>
          </div>

          {p.maxPerUser != null && (
            <p className="mt-2 text-center text-xs text-gray-400">
              お一人様 累計 {p.maxPerUser} 個まで購入可能です
            </p>
          )}
        </div>
      </div>

      {/* 詳細説明・注意事項（全幅） */}
      <div className="mt-12 space-y-8">
        {p.description && (
          <section>
            <h2 className="mb-3 border-l-4 border-brand-500 pl-3 text-lg font-bold text-gray-900">
              商品・イベント詳細
            </h2>
            <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
              {p.description}
            </p>
          </section>
        )}

        {anyNickname && (
          <section>
            <h2 className="mb-3 border-l-4 border-brand-500 pl-3 text-lg font-bold text-gray-900">
              ニックネームについて
            </h2>
            <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
              {p.nicknameNote ??
                "サインの宛名になります。ご購入手続き時に必ずご入力ください（10文字以内・よみがな必須）。一度ご注文いただいたニックネームの変更はできません。"}
            </p>
          </section>
        )}

        {p.notes && (
          <section>
            <h2 className="mb-3 border-l-4 border-red-400 pl-3 text-lg font-bold text-gray-900">
              注意事項
            </h2>
            <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {p.notes}
              </p>
            </div>
          </section>
        )}

        {p.event.notes && (
          <section>
            <h2 className="mb-3 border-l-4 border-gray-300 pl-3 text-lg font-bold text-gray-900">
              イベント共通の注意事項
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
              {p.event.notes}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
