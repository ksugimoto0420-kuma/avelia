import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventCard, type EventCardData } from "@/components/user/EventCard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getArtist(slug: string) {
  return prisma.artist.findFirst({
    where: { slug, isPublished: true },
    include: {
      events: {
        where: { isPublished: true },
        orderBy: { saleStartAt: "desc" },
        take: 30,
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) return { title: "アーティストが見つかりません" };
  return {
    title: artist.name,
    description: artist.profileText ?? undefined,
    openGraph: {
      title: artist.name,
      description: artist.profileText ?? undefined,
      images: artist.imageUrl ? [artist.imageUrl] : undefined,
    },
  };
}

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) notFound();

  const cards: EventCardData[] = artist.events.map((e) => ({
    id: e.id,
    title: e.title,
    artistName: e.artistName ?? artist.name,
    eventType: e.eventType,
    saleMethod: e.saleMethod,
    eventDate: e.eventDate,
    coverImageUrl: e.coverImageUrl,
    isPublished: e.isPublished,
    saleStartAt: e.saleStartAt,
    saleEndAt: e.saleEndAt,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
        ← トップへ戻る
      </Link>

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {artist.imageUrl && (
          <div className="h-40 w-40 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artist.imageUrl}
              alt={artist.name}
              className="h-full w-full object-cover object-top"
            />
          </div>
        )}
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-3xl font-bold text-gray-900">{artist.name}</h1>
          {artist.nameKana && (
            <p className="mt-1 text-sm text-gray-500">{artist.nameKana}</p>
          )}
          {artist.profileText && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {artist.profileText}
            </p>
          )}
        </div>
      </div>

      <h2 className="mt-12 text-xl font-bold text-gray-900">
        このアーティストのイベント（{cards.length}件）
      </h2>
      {cards.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
          公開中のイベントはありません
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
