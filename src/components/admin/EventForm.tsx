import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { SearchableSelectField } from "@/components/ui/SearchableSelectField";
import { saveEvent } from "@/app/admin/events/actions";
import { toJstDateTimeLocalString } from "@/lib/utils";

type EventData = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  artistId: string | null;
  artistName: string | null;
  eventType: string;
  saleMethod: string;
  eventDate: Date | null;
  streamingUrl: string | null;
  isPublished: boolean;
  saleStartAt: Date | null;
  saleEndAt: Date | null;
  maxPerUser: number | null;
  capacity: number | null;
  notes: string | null;
};

type ArtistOption = { id: string; name: string };

const dtLocal = (d: Date | null) => toJstDateTimeLocalString(d);

const labelCls = "mb-1 block text-sm font-medium text-gray-700";
const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function EventForm({
  event,
  artists = [],
}: {
  event?: EventData;
  artists?: ArtistOption[];
}) {
  return (
    <form action={saveEvent} className="space-y-6">
      {event && <input type="hidden" name="id" value={event.id} />}

      <Card>
        <CardHeader title="基本情報" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>種別 *</label>
              <select
                name="eventType"
                defaultValue={event?.eventType ?? "MEET_GREET"}
                className={inputCls}
              >
                <option value="MEET_GREET">オンライン特典会</option>
                <option value="KUJI">すきくじ（抽選くじ）</option>
                <option value="TRADING_CARD">トレカ</option>
                <option value="GOODS">グッズ</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>販売方式 *</label>
              <select
                name="saleMethod"
                defaultValue={event?.saleMethod ?? "FIRST_COME"}
                className={inputCls}
              >
                <option value="FIRST_COME">先着販売</option>
                <option value="LOTTERY">抽選販売</option>
              </select>
            </div>
          </div>
          {artists.length > 0 && (
            <div>
              <label htmlFor="event-artistId" className={labelCls}>
                アーティスト（マスタから選択）
              </label>
              <SearchableSelectField
                id="event-artistId"
                name="artistId"
                defaultValue={event?.artistId ?? ""}
                allowEmpty
                emptyLabel="（マスタ未紐付け）"
                emptyValue=""
                placeholder="アーティストを選択"
                searchPlaceholder="アーティスト名で検索…"
                options={artists.map((a) => ({ value: a.id, label: a.name }))}
              />
              <p className="mt-1 text-xs text-gray-500">
                マスタ未登録なら下の「アーティスト名（自由記入）」で表示します。
              </p>
            </div>
          )}
          <div>
            <label className={labelCls}>アーティスト名（自由記入・後方互換）</label>
            <input
              name="artistName"
              defaultValue={event?.artistName ?? ""}
              className={inputCls}
              placeholder="例: 星野ひなた"
            />
          </div>
          <div>
            <label className={labelCls}>タイトル *</label>
            <input
              name="title"
              required
              defaultValue={event?.title}
              className={inputCls}
              placeholder="例: 星野ひなた オンライン特典会 2026"
            />
          </div>
          <div>
            <label className={labelCls}>スラッグ（URL識別子・省略可）</label>
            <input
              name="slug"
              defaultValue={event?.slug}
              className={inputCls}
              placeholder="summer-live-2026"
            />
          </div>
          <div>
            <label className={labelCls}>説明</label>
            <textarea
              name="description"
              defaultValue={event?.description ?? ""}
              className={`${inputCls} min-h-28`}
            />
          </div>
          <div>
            <label className={labelCls}>カバー画像URL</label>
            <input
              name="coverImageUrl"
              defaultValue={event?.coverImageUrl ?? ""}
              className={inputCls}
              placeholder="https://…"
            />
            <p className="mt-1 text-xs text-gray-500">
              推奨：<b>1200×675px（16:9 横長）</b> のJPEG/PNG。
              一覧カードと詳細ヒーローで使われます。 人物や文字は
              中央寄りに配置すると、端が切れにくくなります。
            </p>
            {event?.coverImageUrl && (
              <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
                <div className="aspect-[16/9] w-full bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={event.coverImageUrl}
                    alt="プレビュー"
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="bg-gray-50 px-2 py-1 text-xs text-gray-500">
                  プレビュー（16:9 でトリミングされます）
                </p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="販売設定" />
        <CardBody className="space-y-4">
          <div>
            <label className={labelCls}>開催日時（特典会・サイン会の実施日時）</label>
            <DateTimeField
              name="eventDate"
              defaultValue={dtLocal(event?.eventDate ?? null)}
            />
          </div>
          <div>
            <label className={labelCls}>配信URL（YouTube Live等）</label>
            <input
              type="url"
              name="streamingUrl"
              defaultValue={event?.streamingUrl ?? ""}
              className={inputCls}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <p className="mt-1 text-xs text-gray-500">
              購入者は視聴任意。開催日時が近づくと、購入者向けに「視聴する」ボタンとして表示されます。
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>販売開始日時</label>
              <DateTimeField
                name="saleStartAt"
                defaultValue={dtLocal(event?.saleStartAt ?? null)}
              />
            </div>
            <div>
              <label className={labelCls}>販売終了日時</label>
              <DateTimeField
                name="saleEndAt"
                defaultValue={dtLocal(event?.saleEndAt ?? null)}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>
              1ユーザーあたりイベント累計購入上限（空欄=無制限）
            </label>
            <input
              type="number"
              name="maxPerUser"
              min={0}
              defaultValue={event?.maxPerUser ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              サイン会の参加枠（定員、空欄=物理在庫だけで制限）
            </label>
            <input
              type="number"
              name="capacity"
              min={0}
              defaultValue={event?.capacity ?? ""}
              className={inputCls}
              placeholder="例: 100"
            />
            <p className="mt-1 text-xs text-gray-500">
              複数商品（CD・チェキ等）の販売数合計に対する上限です。出演者の対応可能人数を設定してください。
            </p>
          </div>
          <div>
            <label className={labelCls}>注意事項</label>
            <textarea
              name="notes"
              defaultValue={event?.notes ?? ""}
              className={`${inputCls} min-h-20`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={event?.isPublished}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            公開する
          </label>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-3">
        <Button href="/admin/events" variant="outline">
          キャンセル
        </Button>
        <Button type="submit">{event ? "更新する" : "作成する"}</Button>
      </div>
    </form>
  );
}
