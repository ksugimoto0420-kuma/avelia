import Link from "next/link";
import { notFound } from "next/navigation";
import { KujiCampaignForm } from "@/components/admin/KujiCampaignForm";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatYen } from "@/lib/utils";
import {
  deleteKujiBundle,
  deleteKujiCampaign,
  deleteKujiPrize,
  saveKujiBundle,
  saveKujiPrize,
} from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "アベリアくじ編集" };

const labelCls = "mb-1 block text-xs font-medium text-gray-600";
const inputCls =
  "w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none";

export default async function EditKujiPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const { campaignId } = await params;

  const [campaign, artists] = await Promise.all([
    prisma.kujiCampaign.findUnique({
      where: { id: campaignId },
      include: {
        prizes: { orderBy: { order: "asc" } },
        bundles: {
          orderBy: { drawCount: "asc" },
          include: { bonusPrize: { select: { rank: true, name: true } } },
        },
        _count: { select: { draws: true } },
      },
    }),
    prisma.artist.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, name: true },
    }),
  ]);
  if (!campaign) notFound();

  const canDelete = campaign._count.draws === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/kuji"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← アベリアくじ一覧
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            アベリアくじ編集
          </h1>
        </div>
        <Link
          href={`/admin/kuji/${campaign.id}/draws`}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          抽選履歴を見る ({campaign._count.draws})
        </Link>
      </div>

      <KujiCampaignForm
        initial={{
          id: campaign.id,
          title: campaign.title,
          description: campaign.description,
          bannerImageUrl: campaign.bannerImageUrl,
          artistId: campaign.artistId,
          saleStartAt: campaign.saleStartAt,
          saleEndAt: campaign.saleEndAt,
          pricePerDraw: campaign.pricePerDraw,
          deliveryNote: campaign.deliveryNote,
          notesText: campaign.notesText,
          status: campaign.status,
        }}
        artists={artists.map((a) => ({ id: a.id, label: a.name }))}
      />

      {/* 賞の管理 */}
      <Card>
        <CardHeader
          title="賞の設定"
          subtitle="S/A/B... 任意のランクで賞を追加できます。本数制(LIMITED)は在庫管理あり、確率制(PROBABILITY)は重み比で抽選されます。"
        />
        <CardBody className="space-y-6">
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">順</th>
                  <th className="px-3 py-2 text-left">ランク</th>
                  <th className="px-3 py-2 text-left">賞品名</th>
                  <th className="px-3 py-2 text-left">タイプ</th>
                  <th className="px-3 py-2 text-right">本数 / 残数</th>
                  <th className="px-3 py-2 text-right">確率重み</th>
                  <th className="px-3 py-2 text-left">フラグ</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaign.prizes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-gray-400"
                    >
                      賞がまだ登録されていません
                    </td>
                  </tr>
                ) : (
                  campaign.prizes.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-gray-500">{p.order}</td>
                      <td className="px-3 py-2 font-medium">{p.rank}</td>
                      <td className="px-3 py-2">
                        <p>{p.name}</p>
                        {p.variantNote && (
                          <p className="text-xs text-gray-400">
                            {p.variantNote}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <Badge
                          color={p.type === "LIMITED" ? "purple" : "blue"}
                        >
                          {p.type === "LIMITED" ? "本数制" : "確率制"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-600">
                        {p.type === "LIMITED"
                          ? `${p.totalCount ?? 0} / ${p.remainingCount ?? 0}`
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-600">
                        {p.type === "PROBABILITY"
                          ? p.probabilityWeight ?? 0
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {p.bundleOnly && (
                          <Badge color="yellow">連数オマケ専用</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <details className="inline-block text-left">
                          <summary className="cursor-pointer text-xs text-brand-600">
                            編集
                          </summary>
                          <PrizeFormBody
                            campaignId={campaign.id}
                            prize={p}
                          />
                        </details>
                        <form
                          action={deleteKujiPrize}
                          className="inline-block"
                        >
                          <input type="hidden" name="id" value={p.id} />
                          <input
                            type="hidden"
                            name="campaignId"
                            value={campaign.id}
                          />
                          <button
                            type="submit"
                            className="ml-2 text-xs text-red-600 hover:underline"
                          >
                            削除
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <details className="rounded-lg border border-dashed border-gray-300 p-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-600">
              ＋ 賞を追加
            </summary>
            <PrizeFormBody campaignId={campaign.id} />
          </details>
        </CardBody>
      </Card>

      {/* 連数SKU管理 */}
      <Card>
        <CardHeader
          title="連数SKU"
          subtitle="1連/10連/50連/100連 などの購入単位と価格、連数限定オマケ賞を設定します。"
        />
        <CardBody className="space-y-6">
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">連数</th>
                  <th className="px-3 py-2 text-right">セット価格</th>
                  <th className="px-3 py-2 text-left">連数オマケ</th>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaign.bundles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-gray-400"
                    >
                      連数SKUがまだ登録されていません
                    </td>
                  </tr>
                ) : (
                  campaign.bundles.map((b) => (
                    <tr key={b.id}>
                      <td className="px-3 py-2 font-medium">{b.drawCount}連</td>
                      <td className="px-3 py-2 text-right">
                        {formatYen(b.priceTotal)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {b.bonusPrize
                          ? `${b.bonusPrize.rank}賞 ${b.bonusPrize.name}`
                          : "（なし）"}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {b.sku ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <details className="inline-block text-left">
                          <summary className="cursor-pointer text-xs text-brand-600">
                            編集
                          </summary>
                          <BundleFormBody
                            campaignId={campaign.id}
                            bundle={b}
                            prizes={campaign.prizes}
                          />
                        </details>
                        <form
                          action={deleteKujiBundle}
                          className="inline-block"
                        >
                          <input type="hidden" name="id" value={b.id} />
                          <input
                            type="hidden"
                            name="campaignId"
                            value={campaign.id}
                          />
                          <button
                            type="submit"
                            className="ml-2 text-xs text-red-600 hover:underline"
                          >
                            削除
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <details className="rounded-lg border border-dashed border-gray-300 p-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-600">
              ＋ 連数SKUを追加
            </summary>
            <BundleFormBody
              campaignId={campaign.id}
              prizes={campaign.prizes}
            />
          </details>
        </CardBody>
      </Card>

      {/* 削除 */}
      <Card className="border-red-200">
        <CardHeader title="削除" />
        <CardBody>
          {canDelete ? (
            <form action={deleteKujiCampaign}>
              <input type="hidden" name="id" value={campaign.id} />
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                このくじを削除する
              </button>
            </form>
          ) : (
            <p className="text-sm text-gray-600">
              抽選履歴があるため削除できません。
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function PrizeFormBody({
  campaignId,
  prize,
}: {
  campaignId: string;
  prize?: {
    id: string;
    rank: string;
    order: number;
    name: string;
    imageUrl: string | null;
    variantNote: string | null;
    type: string;
    totalCount: number | null;
    probabilityWeight: number | null;
    bundleOnly: boolean;
  };
}) {
  return (
    <form
      action={saveKujiPrize}
      className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"
    >
      <input type="hidden" name="campaignId" value={campaignId} />
      {prize?.id && <input type="hidden" name="id" value={prize.id} />}
      <div>
        <label htmlFor={`prize-rank-${prize?.id ?? "new"}`} className={labelCls}>
          ランク *
        </label>
        <input
          id={`prize-rank-${prize?.id ?? "new"}`}
          name="rank"
          required
          defaultValue={prize?.rank ?? ""}
          className={inputCls}
          placeholder="S / A / B ..."
        />
      </div>
      <div>
        <label htmlFor={`prize-order-${prize?.id ?? "new"}`} className={labelCls}>
          表示順
        </label>
        <input
          id={`prize-order-${prize?.id ?? "new"}`}
          name="order"
          type="number"
          defaultValue={prize?.order ?? 0}
          className={inputCls}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`prize-name-${prize?.id ?? "new"}`} className={labelCls}>
          賞品名 *
        </label>
        <input
          id={`prize-name-${prize?.id ?? "new"}`}
          name="name"
          required
          defaultValue={prize?.name ?? ""}
          className={inputCls}
        />
      </div>
      <div className="sm:col-span-2">
        <label
          htmlFor={`prize-variantNote-${prize?.id ?? "new"}`}
          className={labelCls}
        >
          バリエーション説明
        </label>
        <input
          id={`prize-variantNote-${prize?.id ?? "new"}`}
          name="variantNote"
          defaultValue={prize?.variantNote ?? ""}
          className={inputCls}
          placeholder="例: 14種：各キャラA/B"
        />
      </div>
      <div className="sm:col-span-2">
        <ImageUploadField
          name="imageUrl"
          defaultValue={prize?.imageUrl ?? ""}
          bucket="public-assets"
          purpose="kuji-prize"
          targetId={campaignId}
          label="賞品画像"
          hint="推奨: 正方形 (1:1) JPEG/PNG。くじ演出・結果表示で使用。"
          previewAspect="square"
        />
      </div>
      <div>
        <label htmlFor={`prize-type-${prize?.id ?? "new"}`} className={labelCls}>
          タイプ *
        </label>
        <select
          id={`prize-type-${prize?.id ?? "new"}`}
          name="type"
          defaultValue={prize?.type ?? "PROBABILITY"}
          className={inputCls}
        >
          <option value="LIMITED">本数制（上位賞向け）</option>
          <option value="PROBABILITY">確率制（下位賞向け）</option>
        </select>
      </div>
      <div>
        <label htmlFor={`prize-totalCount-${prize?.id ?? "new"}`} className={labelCls}>
          本数（LIMITED のとき）
        </label>
        <input
          id={`prize-totalCount-${prize?.id ?? "new"}`}
          name="totalCount"
          type="number"
          min={0}
          defaultValue={prize?.totalCount ?? 0}
          className={inputCls}
        />
      </div>
      <div>
        <label
          htmlFor={`prize-probabilityWeight-${prize?.id ?? "new"}`}
          className={labelCls}
        >
          確率重み（PROBABILITY のとき、合計10000推奨）
        </label>
        <input
          id={`prize-probabilityWeight-${prize?.id ?? "new"}`}
          name="probabilityWeight"
          type="number"
          min={0}
          defaultValue={prize?.probabilityWeight ?? 0}
          className={inputCls}
          placeholder="例: 30 (=0.30%)"
        />
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="bundleOnly"
            defaultChecked={prize?.bundleOnly ?? false}
          />
          連数オマケ専用（通常抽選から除外）
        </label>
      </div>
      <div className="sm:col-span-2 text-right">
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          {prize?.id ? "更新" : "追加"}
        </button>
      </div>
    </form>
  );
}

function BundleFormBody({
  campaignId,
  bundle,
  prizes,
}: {
  campaignId: string;
  bundle?: {
    id: string;
    drawCount: number;
    priceTotal: number;
    bonusPrizeId: string | null;
    sku: string | null;
  };
  prizes: { id: string; rank: string; name: string }[];
}) {
  return (
    <form
      action={saveKujiBundle}
      className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"
    >
      <input type="hidden" name="campaignId" value={campaignId} />
      {bundle?.id && <input type="hidden" name="id" value={bundle.id} />}
      <div>
        <label
          htmlFor={`bundle-drawCount-${bundle?.id ?? "new"}`}
          className={labelCls}
        >
          連数 *
        </label>
        <input
          id={`bundle-drawCount-${bundle?.id ?? "new"}`}
          name="drawCount"
          type="number"
          required
          min={1}
          defaultValue={bundle?.drawCount ?? 1}
          className={inputCls}
        />
      </div>
      <div>
        <label
          htmlFor={`bundle-priceTotal-${bundle?.id ?? "new"}`}
          className={labelCls}
        >
          セット価格（円） *
        </label>
        <input
          id={`bundle-priceTotal-${bundle?.id ?? "new"}`}
          name="priceTotal"
          type="number"
          required
          min={1}
          defaultValue={bundle?.priceTotal ?? 0}
          className={inputCls}
        />
      </div>
      <div className="sm:col-span-2">
        <label
          htmlFor={`bundle-bonusPrizeId-${bundle?.id ?? "new"}`}
          className={labelCls}
        >
          連数オマケ賞（任意）
        </label>
        <select
          id={`bundle-bonusPrizeId-${bundle?.id ?? "new"}`}
          name="bonusPrizeId"
          defaultValue={bundle?.bonusPrizeId ?? ""}
          className={inputCls}
        >
          <option value="">（なし）</option>
          {prizes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.rank}賞 {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`bundle-sku-${bundle?.id ?? "new"}`} className={labelCls}>
          SKU（任意）
        </label>
        <input
          id={`bundle-sku-${bundle?.id ?? "new"}`}
          name="sku"
          defaultValue={bundle?.sku ?? ""}
          className={inputCls}
        />
      </div>
      <div className="sm:col-span-2 text-right">
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          {bundle?.id ? "更新" : "追加"}
        </button>
      </div>
    </form>
  );
}
