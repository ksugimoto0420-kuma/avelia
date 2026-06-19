import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { SearchableSelectField } from "@/components/ui/SearchableSelectField";
import { saveLottery } from "@/app/admin/lotteries/actions";
import { toJstDateTimeLocalString } from "@/lib/utils";

export type LotteryFormData = {
  id?: string;
  title: string;
  description: string | null;
  eventId: string | null;
  productId: string | null;
  entryStartAt: Date | null;
  entryEndAt: Date | null;
  purchaseDeadlineAt: Date | null;
  winnersCount: number;
  status: string;
};

const dtLocal = (d: Date | null) => toJstDateTimeLocalString(d);

const labelCls = "mb-1 block text-sm font-medium text-gray-700";
const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

type Option = { id: string; label: string };

export function LotteryForm({
  initial,
  events,
  products,
}: {
  initial?: LotteryFormData;
  events: Option[];
  products: Option[];
}) {
  return (
    <form action={saveLottery} className="space-y-6">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <Card>
        <CardHeader title="基本情報" />
        <CardBody className="space-y-4">
          <div>
            <label htmlFor="lottery-title" className={labelCls}>
              タイトル *
            </label>
            <input
              id="lottery-title"
              name="title"
              required
              defaultValue={initial?.title ?? ""}
              className={inputCls}
              placeholder="例: 星野ひなた サイン入りチェキ抽選"
            />
          </div>
          <div>
            <label htmlFor="lottery-description" className={labelCls}>
              説明
            </label>
            <textarea
              id="lottery-description"
              name="description"
              defaultValue={initial?.description ?? ""}
              className={`${inputCls} min-h-24`}
              placeholder="抽選の対象や注意事項など"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lottery-eventId" className={labelCls}>
                対象イベント
              </label>
              <SearchableSelectField
                id="lottery-eventId"
                name="eventId"
                defaultValue={initial?.eventId ?? ""}
                allowEmpty
                emptyLabel="（指定なし）"
                emptyValue=""
                placeholder="イベントを選択"
                searchPlaceholder="アーティスト名やイベント名で検索…"
                options={events.map((e) => ({ value: e.id, label: e.label }))}
              />
            </div>
            <div>
              <label htmlFor="lottery-productId" className={labelCls}>
                当選者が購入できる商品
              </label>
              <SearchableSelectField
                id="lottery-productId"
                name="productId"
                defaultValue={initial?.productId ?? ""}
                allowEmpty
                emptyLabel="（指定なし）"
                emptyValue=""
                placeholder="商品を選択"
                searchPlaceholder="イベント名や商品名で検索…"
                options={products.map((p) => ({
                  value: p.id,
                  label: p.label,
                }))}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="応募・抽選設定" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lottery-entryStartAt" className={labelCls}>
                応募開始日時 *
              </label>
              <DateTimeField
                id="lottery-entryStartAt"
                name="entryStartAt"
                required
                defaultValue={dtLocal(initial?.entryStartAt ?? null)}
              />
            </div>
            <div>
              <label htmlFor="lottery-entryEndAt" className={labelCls}>
                応募終了日時 *
              </label>
              <DateTimeField
                id="lottery-entryEndAt"
                name="entryEndAt"
                required
                defaultValue={dtLocal(initial?.entryEndAt ?? null)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lottery-winnersCount" className={labelCls}>
                当選者数(人)
              </label>
              <input
                id="lottery-winnersCount"
                type="number"
                name="winnersCount"
                min={0}
                defaultValue={initial?.winnersCount ?? 0}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="lottery-purchaseDeadlineAt" className={labelCls}>
                当選者の購入期限
              </label>
              <DateTimeField
                id="lottery-purchaseDeadlineAt"
                name="purchaseDeadlineAt"
                defaultValue={dtLocal(initial?.purchaseDeadlineAt ?? null)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="lottery-status" className={labelCls}>
              状態
            </label>
            <select
              id="lottery-status"
              name="status"
              defaultValue={initial?.status ?? "DRAFT"}
              className={inputCls}
            >
              <option value="DRAFT">下書き</option>
              <option value="OPEN">受付中（応募可能）</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              「締切」「抽選済」への遷移は応募締切後の運用操作で行います。
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-3">
        <Button href="/admin/lotteries" variant="outline">
          キャンセル
        </Button>
        <Button type="submit">{initial?.id ? "更新する" : "作成する"}</Button>
      </div>
    </form>
  );
}
