import type { EventType, SaleMethod } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import {
  EVENT_TYPE_COLOR,
  EVENT_TYPE_LABEL,
  SALE_METHOD_COLOR,
  SALE_METHOD_LABEL,
} from "@/lib/event-meta";
import {
  getSaleStatus,
  SALE_STATUS_COLOR,
  SALE_STATUS_LABEL,
} from "@/lib/sale";
import { formatDateTime } from "@/lib/utils";

export type EventCardData = {
  id: string;
  title: string;
  artistName: string | null;
  eventType: EventType;
  saleMethod: SaleMethod;
  eventDate: Date | string | null;
  coverImageUrl: string | null;
  isPublished: boolean;
  saleStartAt: Date | string | null;
  saleEndAt: Date | string | null;
};

export function EventCard({ event }: { event: EventCardData }) {
  const status = getSaleStatus({
    isPublished: event.isPublished,
    saleStartAt: event.saleStartAt ? new Date(event.saleStartAt) : null,
    saleEndAt: event.saleEndAt ? new Date(event.saleEndAt) : null,
  });

  return (
    <Link
      href={`/events/${event.id}`}
      className="group block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-brand-100 to-brand-50">
        {event.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverImageUrl}
            alt={event.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl font-black text-brand-300">
            {(event.artistName ?? event.title).slice(0, 2)}
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge color={SALE_STATUS_COLOR[status]}>
            {SALE_STATUS_LABEL[status]}
          </Badge>
          <Badge color={SALE_METHOD_COLOR[event.saleMethod]}>
            {SALE_METHOD_LABEL[event.saleMethod]}
          </Badge>
        </div>
      </div>
      <div className="p-4">
        <div className="mb-1.5">
          <Badge color={EVENT_TYPE_COLOR[event.eventType]}>
            {EVENT_TYPE_LABEL[event.eventType]}
          </Badge>
        </div>
        {event.artistName && (
          <p className="text-xs font-semibold text-brand-600">
            {event.artistName}
          </p>
        )}
        <h3 className="line-clamp-2 font-bold text-gray-900 group-hover:text-brand-600">
          {event.title}
        </h3>
        {event.eventDate && (
          <p className="mt-2 text-xs text-gray-500">
            開催: {formatDateTime(event.eventDate)}
          </p>
        )}
        <p className="mt-0.5 text-xs text-gray-400">
          販売期間: 〜{formatDateTime(event.saleEndAt)}
        </p>
      </div>
    </Link>
  );
}
