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

        {/*
          決済手数料の設定はデモ段階では非表示。
          設定値 (paymentFeeRate) と R/S 集計ロジックは保持しており、
          再表示する際はこのブロックのコメントを外すだけで戻せる。
        */}

        {/*
          R/S 階段制（弊社取り分率）はデモ段階では非表示。
          設定値（rsTier1Threshold / rsTier1Rate / rsTier2Threshold /
          rsTier2Rate / rsTier3Rate）と R/S 売上集計ロジックは保持しており、
          再表示する際はこのブロックのコメントを外すだけで戻せる。
        */}

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
