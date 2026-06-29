import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaImage } from "@/components/ui/MediaImage";
import { calcPrizeRatios } from "@/lib/kuji/draw";
import { getOptionalUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";
import { purchaseKujiBundle } from "../actions";

export const dynamic = "force-dynamic";

/**
 * アベリアくじ 詳細ページ。
 * sukisuki-shop の構成を参考に、上から順に：
 *   1. バナー
 *   2. グループ名 + タイトル
 *   3. 基本情報（販売期間 / 1回単価 / お届け目安）
 *   4. ラインナップ（賞の縦長リスト：S/A/B... + 確率% + 画像）
 *   5. 連購入特典（10連/50連/100連のオマケ賞）
 *   6. 購入ボタン群（1連/10連/50連/100連 を横並び）
 *   7. 注意事項
 */
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

  const mainPrizes = campaign.prizes.filter((p) => !p.bundleOnly);
  const bonusPrizes = campaign.prizes.filter((p) => p.bundleOnly);

  return (
    <div className="bg-gray-50 pb-32 sm:pb-24">
      <div className="mx-auto max-w-3xl bg-white">
        {/* ヘッダー：戻るリンク + バナー */}
        <div className="px-4 pt-4">
          <Link
            href="/kuji"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← アベリアくじ一覧
          </Link>
        </div>
        <div className="mt-3">
          <MediaImage
            src={campaign.bannerImageUrl}
            alt={campaign.title}
            aspect="16/9"
          />
        </div>

        <div className="space-y-8 px-4 py-6">
          {/* タイトル */}
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={
                  "rounded-md px-2.5 py-1 text-xs font-bold " +
                  (isOpen
                    ? "bg-pink-600 text-white"
                    : "bg-gray-300 text-gray-700")
                }
              >
                {isOpen ? "販売中" : "販売外"}
              </span>
              <span className="rounded-md bg-pink-50 px-2.5 py-1 text-xs font-bold text-pink-700">
                アベリアくじ
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {campaign.artist?.name ?? campaign.event?.artistName ?? ""}
              {campaign.event?.title ? ` / ${campaign.event.title}` : ""}
            </p>
            <h1 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
              {campaign.title}
            </h1>
            {campaign.description && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                {campaign.description}
              </p>
            )}
          </header>

          {/* 基本情報 */}
          <section>
            <div className="space-y-1.5 rounded-xl bg-pink-50/60 px-4 py-3 text-sm">
              <Row
                label="販売期間"
                value={`${formatDateTime(campaign.saleStartAt)} 〜 ${formatDateTime(campaign.saleEndAt)}`}
              />
              <Row
                label="販売価格"
                value={
                  <>
                    1回{" "}
                    <b className="text-pink-600">
                      {formatYen(campaign.pricePerDraw)}
                    </b>
                    （税込）
                  </>
                }
              />
              {campaign.deliveryNote && (
                <Row label="お届け目安" value={campaign.deliveryNote} />
              )}
            </div>
          </section>

          {/* ラインナップ */}
          <section>
            <h2 className="text-lg font-bold text-gray-900">
              ラインナップ
            </h2>
            <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-100">
              {mainPrizes.map((p) => {
                const pct = ratioMap.get(p.id) ?? 0;
                return (
                  <li key={p.id} className="p-4">
                    <div className="flex items-baseline gap-3">
                      <span className="text-2xl font-extrabold text-pink-600">
                        {p.rank}賞
                      </span>
                      <span className="text-xs font-medium text-gray-500">
                        当選確率 {pct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div className="w-full shrink-0 sm:w-40">
                        <MediaImage
                          src={p.imageUrl}
                          alt={p.name}
                          aspect="1/1"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-gray-900">
                          {p.name}
                        </p>
                        {p.variantNote && (
                          <p className="mt-1 text-xs text-gray-500">
                            {p.variantNote}
                          </p>
                        )}
                        {p.type === "LIMITED" && (
                          <p className="mt-1 text-xs text-gray-500">
                            本数限定: 残 {p.remainingCount ?? 0} / 全{" "}
                            {p.totalCount ?? 0}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 連購入特典 */}
          {(bonusPrizes.length > 0 ||
            campaign.bundles.some((b) => b.bonusPrize)) && (
            <section>
              <h2 className="text-lg font-bold text-gray-900">
                連購入特典
              </h2>
              <ul className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                {campaign.bundles
                  .filter((b) => b.bonusPrize)
                  .map((b) => (
                    <li key={b.id} className="flex gap-2 text-sm">
                      <span className="shrink-0 font-bold text-amber-700">
                        {b.drawCount}連:
                      </span>
                      <span className="text-gray-800">
                        {b.bonusPrize!.rank}賞 {b.bonusPrize!.name}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {/* 購入ボタン群 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900">購入</h2>
            {!isOpen ? (
              <p className="mt-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                現在は販売期間外です。
              </p>
            ) : campaign.bundles.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">
                連数SKUが設定されていません
              </p>
            ) : (
              <>
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {campaign.bundles.map((b) => (
                    <li key={b.id}>
                      {user ? (
                        <form action={purchaseKujiBundle}>
                          <input
                            type="hidden"
                            name="campaignId"
                            value={campaign.id}
                          />
                          <input
                            type="hidden"
                            name="bundleId"
                            value={b.id}
                          />
                          <button
                            type="submit"
                            className="w-full rounded-xl bg-pink-600 px-3 py-3 text-center text-white shadow-sm transition hover:bg-pink-700"
                          >
                            <span className="block text-base font-extrabold">
                              {b.drawCount}連購入
                            </span>
                            <span className="block text-xs opacity-90">
                              {formatYen(b.priceTotal)}
                            </span>
                          </button>
                        </form>
                      ) : (
                        <Link
                          href={`/auth/login?callbackUrl=${encodeURIComponent(`/kuji/${campaign.id}`)}`}
                          className="block w-full rounded-xl border border-pink-300 bg-white px-3 py-3 text-center text-pink-700 shadow-sm transition hover:bg-pink-50"
                        >
                          <span className="block text-base font-extrabold">
                            {b.drawCount}連購入
                          </span>
                          <span className="block text-xs opacity-90">
                            {formatYen(b.priceTotal)}
                          </span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-gray-400">
                  ※ デモ環境のため決済はスキップされ、ボタンを押した瞬間に抽選 →
                  結果表示まで進みます。
                </p>
              </>
            )}
          </section>

          {/* 注意事項 */}
          {campaign.notesText && (
            <section>
              <h2 className="text-lg font-bold text-gray-900">
                注意事項
              </h2>
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-xs text-gray-700">
                {campaign.notesText}
              </p>
            </section>
          )}
        </div>
      </div>

      {/* 固定フッター（販売終了 + 購入ボタン） */}
      {campaign.bundles.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            {/* 左: 販売終了時間 */}
            <div className="shrink-0 text-center">
              <p className="inline-block rounded-md bg-pink-500 px-2 py-0.5 text-[11px] font-bold text-white">
                販売終了時間
              </p>
              <p className="mt-0.5 text-xs font-bold text-gray-800">
                {formatSaleEnd(campaign.saleEndAt)}
              </p>
            </div>

            {/* 右: 購入ボタン */}
            <div className="min-w-0 flex-1">
              {!isOpen ? (
                <p className="rounded-lg bg-gray-100 px-3 py-2 text-center text-xs text-gray-600">
                  現在は販売期間外です
                </p>
              ) : (
                <div className="flex items-center justify-end gap-2 overflow-x-auto">
                  {campaign.bundles.map((b) => (
                    <div
                      key={b.id}
                      className="min-w-[88px] shrink-0"
                    >
                      {user ? (
                        <form action={purchaseKujiBundle}>
                          <input
                            type="hidden"
                            name="campaignId"
                            value={campaign.id}
                          />
                          <input
                            type="hidden"
                            name="bundleId"
                            value={b.id}
                          />
                          <button
                            type="submit"
                            className="w-full rounded-full bg-pink-600 px-3 py-2.5 text-center text-white shadow-md transition hover:bg-pink-700 active:scale-[0.98]"
                          >
                            <span className="block text-sm font-extrabold leading-tight">
                              {b.drawCount}連購入
                            </span>
                            <span className="block text-[11px] opacity-90">
                              {formatYen(b.priceTotal)}
                            </span>
                          </button>
                        </form>
                      ) : (
                        <Link
                          href={`/auth/login?callbackUrl=${encodeURIComponent(`/kuji/${campaign.id}`)}`}
                          className="block w-full rounded-full border border-pink-400 bg-white px-3 py-2.5 text-center text-pink-700 shadow-md transition hover:bg-pink-50 active:scale-[0.98]"
                        >
                          <span className="block text-sm font-extrabold leading-tight">
                            {b.drawCount}連購入
                          </span>
                          <span className="block text-[11px] opacity-90">
                            {formatYen(b.priceTotal)}
                          </span>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="shrink-0 font-medium text-gray-700">■ {label}：</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}

/**
 * 固定フッター用の販売終了表記。
 * 例: 「7月12日（日）23:59まで」
 */
function formatSaleEnd(d: Date): string {
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = weekdays[d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${m}月${day}日（${w}）${hh}:${mm}まで`;
}
