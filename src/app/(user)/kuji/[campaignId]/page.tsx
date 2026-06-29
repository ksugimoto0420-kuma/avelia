import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";
import { calcPrizeRatios } from "@/lib/kuji/draw";
import { getOptionalUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";
import { purchaseKujiBundle } from "../actions";

export const dynamic = "force-dynamic";

export default async function KujiDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const user = await getOptionalUser();

  const campaign = await prisma.kujiCampaign.findUnique({
    where: { id: campaignId },
    include: {
      event: { select: { title: true, artistName: true } },
      artist: { select: { name: true } },
      prizes: { orderBy: { order: "asc" } },
      bundles: {
        orderBy: { drawCount: "asc" },
        include: { bonusPrize: { select: { rank: true, name: true } } },
      },
    },
  });
  if (!campaign) notFound();

  const now = new Date();
  const isOpen =
    campaign.status === "OPEN" &&
    campaign.saleStartAt <= now &&
    now <= campaign.saleEndAt;

  const ratios = await calcPrizeRatios(prisma, campaignId);
  const ratioMap = new Map(ratios.map((r) => [r.prizeId, r.percent]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <Link
          href="/kuji"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← アベリアくじ一覧
        </Link>
      </div>
      <MediaImage
        src={campaign.bannerImageUrl}
        alt={campaign.title}
        aspect="16/9"
      />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="pink">アベリアくじ</Badge>
          {isOpen ? (
            <Badge color="green">販売中</Badge>
          ) : (
            <Badge color="gray">販売外</Badge>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {campaign.title}
        </h1>
        <p className="text-sm text-gray-500">
          {campaign.artist?.name ?? campaign.event?.artistName ?? ""}
          {campaign.event?.title ? ` / ${campaign.event.title}` : ""}
        </p>
      </div>
      {campaign.description && (
        <p className="whitespace-pre-wrap text-sm text-gray-700">
          {campaign.description}
        </p>
      )}
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
        <p>
          <b>1回 {formatYen(campaign.pricePerDraw)}</b>
        </p>
        <p className="text-xs text-gray-500">
          販売期間: {formatDateTime(campaign.saleStartAt)} 〜{" "}
          {formatDateTime(campaign.saleEndAt)}
        </p>
        {campaign.deliveryNote && (
          <p className="mt-1 text-xs text-gray-500">
            お届け目安: {campaign.deliveryNote}
          </p>
        )}
      </div>

      {/* 賞ラインナップ */}
      <Card>
        <CardBody>
          <h2 className="mb-3 text-base font-bold text-gray-900">
            ラインナップ
          </h2>
          <ul className="space-y-3">
            {campaign.prizes
              .filter((p) => !p.bundleOnly)
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-start gap-3 rounded-lg border border-gray-100 p-3"
                >
                  <MediaImage
                    src={p.imageUrl}
                    alt={p.name}
                    aspect="1/1"
                    className="w-20 shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold">
                      <span className="text-pink-600">{p.rank}賞</span>{" "}
                      {p.name}
                    </p>
                    {p.variantNote && (
                      <p className="text-xs text-gray-500">{p.variantNote}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      確率: {(ratioMap.get(p.id) ?? 0).toFixed(2)}%
                    </p>
                  </div>
                </li>
              ))}
          </ul>
          {campaign.prizes.some((p) => p.bundleOnly) && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs">
              <p className="font-bold text-amber-700">連数オマケ</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {campaign.prizes
                  .filter((p) => p.bundleOnly)
                  .map((p) => (
                    <li key={p.id}>
                      {p.rank}賞 {p.name}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>

      {/* 購入ボタン */}
      <Card>
        <CardBody>
          <h2 className="mb-3 text-base font-bold text-gray-900">購入</h2>
          {!isOpen ? (
            <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
              現在は販売期間外です。
            </p>
          ) : campaign.bundles.length === 0 ? (
            <p className="text-sm text-gray-500">
              連数SKUが設定されていません
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {campaign.bundles.map((b) => (
                <li
                  key={b.id}
                  className="rounded-lg border border-gray-200 p-3"
                >
                  <p className="text-lg font-bold">{b.drawCount}連</p>
                  <p className="text-xl font-bold text-pink-600">
                    {formatYen(b.priceTotal)}
                  </p>
                  {b.bonusPrize && (
                    <p className="mt-1 text-xs text-amber-700">
                      + 連数オマケ: {b.bonusPrize.rank}賞{" "}
                      {b.bonusPrize.name}
                    </p>
                  )}
                  {user ? (
                    <form action={purchaseKujiBundle} className="mt-2">
                      <input
                        type="hidden"
                        name="campaignId"
                        value={campaign.id}
                      />
                      <input type="hidden" name="bundleId" value={b.id} />
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-pink-600 px-4 py-2 text-sm font-bold text-white hover:bg-pink-700"
                      >
                        {b.drawCount}連を引く
                      </button>
                    </form>
                  ) : (
                    <LoginRequiredButton drawCount={b.drawCount} campaignId={campaign.id} />
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-gray-400">
            ※ デモ環境のため決済はスキップされ、ボタンを押した瞬間に抽選 → 結果表示まで進みます。
          </p>
        </CardBody>
      </Card>

      {/* 注意事項 */}
      {campaign.notesText && (
        <Card>
          <CardBody>
            <h2 className="mb-2 text-base font-bold text-gray-900">注意事項</h2>
            <p className="whitespace-pre-wrap text-xs text-gray-600">
              {campaign.notesText}
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function LoginRequiredButton({
  drawCount,
  campaignId,
}: {
  drawCount: number;
  campaignId: string;
}) {
  // Server Component なのでログインリダイレクトリンクで案内する
  const callback = encodeURIComponent(`/kuji/${campaignId}`);
  return (
    <Link
      href={`/auth/login?callbackUrl=${callback}`}
      className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      ログインして {drawCount}連を引く
    </Link>
  );
}
