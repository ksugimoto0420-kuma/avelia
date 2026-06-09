import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
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
            <label className={labelCls}>タイトル *</label>
            <input
              name="title"
              required
              defaultValue={initial?.title ?? ""}
              className={inputCls}
              placeholder="例: 星野ひなた サイン入りチェキ抽選"
            />
          </div>
          <div>
            <label className={labelCls}>説明</label>
            <textarea
              name="description"
              defaultValue={initial?.description ?? ""}
              className={`${inputCls} min-h-24`}
              placeholder="抽選の対象や注意事項など"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>対象イベント</label>
              <select
                name="eventId"
                defaultValue={initial?.eventId ?? ""}
                className={inputCls}
              >
                <option value="">（指定なし）</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>当選者が購入できる商品</label>
              <select
                name="productId"
                defaultValue={initial?.productId ?? ""}
                className={inputCls}
              >
                <option value="">（指定なし）</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="応募・抽選設定" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>応募開始日時 *</label>
              <input
                type="datetime-local"
                name="entryStartAt"
                required
                defaultValue={dtLocal(initial?.entryStartAt ?? null)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>応募終了日時 *</label>
              <input
                type="datetime-local"
                name="entryEndAt"
                required
                defaultValue={dtLocal(initial?.entryEndAt ?? null)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>当選者数（人）</label>
              <input
                type="number"
                name="winnersCount"
                min={0}
                defaultValue={initial?.winnersCount ?? 0}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>当選者の購入期限</label>
              <input
                type="datetime-local"
                name="purchaseDeadlineAt"
                defaultValue={dtLocal(initial?.purchaseDeadlineAt ?? null)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>状態</label>
            <select
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
