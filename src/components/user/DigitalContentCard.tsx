import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  IMAGE: "画像",
  VIDEO: "動画",
  AUDIO: "音声",
  FILE: "ファイル",
};

export type DigitalContentCardData = {
  key: string;
  title: string;
  type: string;
  expiresAt: Date | null;
  expired: boolean;
  // 共通(grant)=内部ページ / 個別(delivery)=ダウンロードURL / 準備中=null
  href: string | null;
  isDownload?: boolean; // href が直接ダウンロードURLなら true
  signed?: boolean; // 個別サイン納品
  pending?: boolean; // 制作待ち（準備中）
  nickname?: string | null;
  /** カバー画像（商品imageUrl → イベントcoverImageUrl → null の順で選定済み） */
  coverImageUrl?: string | null;
};

function FallbackIcon({ type }: { type: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-100 to-brand-50 text-4xl">
      {type === "VIDEO"
        ? "🎬"
        : type === "AUDIO"
          ? "🎵"
          : type === "IMAGE"
            ? "🖼"
            : "📄"}
    </div>
  );
}

function CardInner({ data }: { data: DigitalContentCardData }) {
  return (
    <>
      <div className="relative aspect-video overflow-hidden bg-gray-50">
        {data.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.coverImageUrl}
            alt={data.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <FallbackIcon type={data.type} />
        )}
        {data.signed && (
          <span
            className="absolute right-2 top-2 rounded-full bg-white/85 px-2 py-1 text-base shadow"
            title="サイン入り"
          >
            ✍️
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="purple">{TYPE_LABEL[data.type] ?? data.type}</Badge>
          {data.signed && <Badge color="pink">サイン入り</Badge>}
          {data.pending && <Badge color="yellow">準備中（制作中）</Badge>}
          {data.expired && <Badge color="red">期限切れ</Badge>}
        </div>
        <h3 className="mt-2 line-clamp-2 font-semibold text-gray-900 group-hover:text-brand-600">
          {data.title}
        </h3>
        {data.nickname && (
          <p className="mt-1 text-xs text-brand-600">宛名: {data.nickname}</p>
        )}
        {data.pending ? (
          <p className="mt-1 text-xs text-gray-400">
            サイン制作が完了するとダウンロードできます
          </p>
        ) : data.expiresAt ? (
          <p className="mt-1 text-xs text-gray-400">
            閲覧期限: {formatDate(data.expiresAt)}
          </p>
        ) : null}
      </div>
    </>
  );
}

const cardCls =
  "group block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";

export function DigitalContentCard({ data }: { data: DigitalContentCardData }) {
  if (!data.href) {
    return (
      <div className={`${cardCls} opacity-90`}>
        <CardInner data={data} />
      </div>
    );
  }
  if (data.isDownload) {
    return (
      <a href={data.href} className={cardCls}>
        <CardInner data={data} />
      </a>
    );
  }
  return (
    <Link href={data.href} className={cardCls}>
      <CardInner data={data} />
    </Link>
  );
}
