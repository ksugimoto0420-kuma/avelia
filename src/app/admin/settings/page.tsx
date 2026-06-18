import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { getAllSettings } from "@/lib/settings";
import { saveSettings } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "サイト設定" };

const labelCls = "mb-1 block text-sm font-medium text-gray-700";
const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export default async function AdminSettingsPage() {
  await requireAdminPage("MANAGER");
  const s = await getAllSettings();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">サイト設定</h1>
        <p className="text-sm text-gray-500">
          送料・サポート連絡先などサイト全体の設定。MANAGER以上が編集できます。
        </p>
      </div>

      <form action={saveSettings} className="space-y-6">
        <Card>
          <CardHeader title="送料" subtitle="物販を含む注文のみ加算されます" />
          <CardBody className="space-y-4">
            <div>
              <label htmlFor="shippingFlatRate" className={labelCls}>
                全国一律送料（円） *
              </label>
              <input
                id="shippingFlatRate"
                type="number"
                name="shippingFlatRate"
                defaultValue={s.shippingFlatRate}
                min={0}
                required
                className={inputCls}
              />
              <p className="mt-1 text-xs text-gray-500">
                例: 500（500円）。0にすると送料無料。
              </p>
            </div>
            <div>
              <label htmlFor="shippingFreeThreshold" className={labelCls}>
                送料無料となる小計閾値（円）
              </label>
              <input
                id="shippingFreeThreshold"
                type="number"
                name="shippingFreeThreshold"
                defaultValue={s.shippingFreeThreshold}
                min={0}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-gray-500">
                例: 5000（5000円以上で送料無料）。0で「無料閾値なし」。
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="決済手数料"
            subtitle="R/S 集計時にグロス売上から自動控除されます"
          />
          <CardBody className="space-y-4">
            <div>
              <label htmlFor="paymentFeeRate" className={labelCls}>
                決済手数料率（小数。例: 0.029 = 2.9%）
              </label>
              <input
                id="paymentFeeRate"
                type="number"
                step="0.0001"
                min="0"
                max="1"
                name="paymentFeeRate"
                defaultValue={s.paymentFeeRate}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-gray-500">
                SoftBank / Stripe の請求書に合わせて設定。集計時に
                グロス売上 × この率を切り上げで手数料として控除します。
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="R/S 階段制（弊社取り分率）"
            subtitle="月次グロス売上に応じて率が切り替わります（小→大→大）"
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="rsTier1Threshold" className={labelCls}>
                  第1閾値（円・未満で Tier1）
                </label>
                <input
                  id="rsTier1Threshold"
                  type="number"
                  name="rsTier1Threshold"
                  defaultValue={s.rsTier1Threshold}
                  min={0}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="rsTier1Rate" className={labelCls}>
                  Tier1 弊社率（例: 0.03 = 3%）
                </label>
                <input
                  id="rsTier1Rate"
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  name="rsTier1Rate"
                  defaultValue={s.rsTier1Rate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="rsTier2Threshold" className={labelCls}>
                  第2閾値（円・未満で Tier2）
                </label>
                <input
                  id="rsTier2Threshold"
                  type="number"
                  name="rsTier2Threshold"
                  defaultValue={s.rsTier2Threshold}
                  min={0}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="rsTier2Rate" className={labelCls}>
                  Tier2 弊社率
                </label>
                <input
                  id="rsTier2Rate"
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  name="rsTier2Rate"
                  defaultValue={s.rsTier2Rate}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="rsTier3Rate" className={labelCls}>
                  Tier3 弊社率（第2閾値以上で適用）
                </label>
                <input
                  id="rsTier3Rate"
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  name="rsTier3Rate"
                  defaultValue={s.rsTier3Rate}
                  className={inputCls}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              例: 第1閾値 1,000,000 / Tier1 3%、第2閾値 5,000,000 / Tier2 5%、
              Tier3 10% にすると、月次グロスが 100万円未満は 3%、500万円未満は
              5%、500万円以上は 10% で計算されます。
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="サポート連絡先" />
          <CardBody className="space-y-4">
            <div>
              <label htmlFor="supportEmail" className={labelCls}>
                サポートメールアドレス
              </label>
              <input
                id="supportEmail"
                type="email"
                name="supportEmail"
                defaultValue={s.supportEmail}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-gray-500">
                特商法ページ・お問い合わせ自動返信などで利用します。
              </p>
            </div>
            <div>
              <label htmlFor="siteName" className={labelCls}>
                サイト表示名
              </label>
              <input
                id="siteName"
                name="siteName"
                defaultValue={s.siteName}
                className={inputCls}
              />
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">保存する</Button>
        </div>
      </form>
    </div>
  );
}
