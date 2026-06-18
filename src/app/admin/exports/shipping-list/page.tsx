import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { ShippingListPanel } from "./ShippingListPanel";

export const dynamic = "force-dynamic";

export const metadata = { title: "発送リスト" };

export default async function ShippingListPage() {
  await requireAdminPage("OPERATOR");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">発送リスト</h1>
        <p className="text-sm text-gray-500">
          物販を含む支払済注文を CSV で出力します。発送元と形式を切り替えると
          下のプレビューに対象件数と先頭サンプルが表示されます。倉庫システムへの
          連携は CSV を手動で取り込んで運用する想定です。
        </p>
      </div>

      <Card>
        <CardHeader title="発送リスト CSV" />
        <CardBody>
          <ShippingListPanel />
        </CardBody>
      </Card>
    </div>
  );
}
