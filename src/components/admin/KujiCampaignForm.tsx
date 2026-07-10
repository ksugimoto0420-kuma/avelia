import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { SearchableSelectField } from "@/components/ui/SearchableSelectField";
import { saveKujiCampaign } from "@/app/admin/kuji/actions";
import { toJstDateTimeLocalString } from "@/lib/utils";
import { ImageUploadField } from "./ImageUploadField";

export type KujiCampaignFormData = {
  id?: string;
  title: string;
  description: string | null;
  bannerImageUrl: string | null;
  artistId: string | null;
  saleStartAt: Date | null;
  saleEndAt: Date | null;
  pricePerDraw: number;
  deliveryNote: string | null;
  notesText: string | null;
  status: string;
};

const dtLocal = (d: Date | null) => toJstDateTimeLocalString(d);

const labelCls = "mb-1 block text-sm font-medium text-gray-700";
const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

type Option = { id: string; label: string };

export function KujiCampaignForm({
  initial,
  artists,
}: {
  initial?: KujiCampaignFormData;
  artists: Option[];
}) {
  return (
    <form action={saveKujiCampaign} className="space-y-6">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <Card>
        <CardHeader title="基本情報" />
        <CardBody className="space-y-4">
          <div>
            <label htmlFor="kuji-title" className={labelCls}>
              タイトル *
            </label>
            <input
              id="kuji-title"
              name="title"
              required
              defaultValue={initial?.title ?? ""}
              className={inputCls}
              placeholder="例: 推しオフショット スペシャルアベリアくじ"
            />
          </div>
          <div>
            <label htmlFor="kuji-description" className={labelCls}>
              説明
            </label>
            <textarea
              id="kuji-description"
              name="description"
              defaultValue={initial?.description ?? ""}
              className={`${inputCls} min-h-24`}
              placeholder="くじの紹介文"
            />
          </div>
          <ImageUploadField
            name="bannerImageUrl"
            defaultValue={initial?.bannerImageUrl ?? ""}
            bucket="public-assets"
            purpose="kuji-banner"
            targetId={initial?.id ?? null}
            label="バナー画像"
            hint="推奨: 1200×675px (16:9 横長) の JPEG/PNG。くじ一覧・詳細ページで使用。"
            previewAspect="cover-16-9"
          />
          <div>
            <label htmlFor="kuji-artistId" className={labelCls}>
              出演者
            </label>
            <SearchableSelectField
              id="kuji-artistId"
              name="artistId"
              defaultValue={initial?.artistId ?? ""}
              allowEmpty
              emptyLabel="（指定なし）"
              options={artists.map((a) => ({
                value: a.id,
                label: a.label,
              }))}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="販売期間と料金" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="kuji-saleStartAt" className={labelCls}>
                販売開始 *
              </label>
              <DateTimeField
                id="kuji-saleStartAt"
                name="saleStartAt"
                required
                defaultValue={dtLocal(initial?.saleStartAt ?? null)}
              />
            </div>
            <div>
              <label htmlFor="kuji-saleEndAt" className={labelCls}>
                販売終了 *
              </label>
              <DateTimeField
                id="kuji-saleEndAt"
                name="saleEndAt"
                required
                defaultValue={dtLocal(initial?.saleEndAt ?? null)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="kuji-pricePerDraw" className={labelCls}>
              1回あたりの単価 *（円）
            </label>
            <input
              id="kuji-pricePerDraw"
              name="pricePerDraw"
              type="number"
              min={1}
              required
              defaultValue={initial?.pricePerDraw ?? 770}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="kuji-deliveryNote" className={labelCls}>
              配送目安テキスト
            </label>
            <input
              id="kuji-deliveryNote"
              name="deliveryNote"
              defaultValue={initial?.deliveryNote ?? ""}
              className={inputCls}
              placeholder="例: 2026年10月下旬"
            />
          </div>
          <div>
            <label htmlFor="kuji-notesText" className={labelCls}>
              注意事項
            </label>
            <textarea
              id="kuji-notesText"
              name="notesText"
              defaultValue={initial?.notesText ?? ""}
              className={`${inputCls} min-h-32`}
              placeholder="購入後のキャンセル不可・転売禁止 などの注意事項"
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="公開設定" />
        <CardBody>
          <label htmlFor="kuji-status" className={labelCls}>
            状態
          </label>
          <select
            id="kuji-status"
            name="status"
            defaultValue={initial?.status ?? "DRAFT"}
            className={inputCls}
          >
            <option value="DRAFT">下書き</option>
            <option value="OPEN">販売中</option>
          </select>
          <p className="mt-2 text-xs text-gray-500">
            終了 (CLOSED) は販売終了日時を過ぎたら自動で扱われます。
          </p>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">保存</Button>
      </div>
    </form>
  );
}
