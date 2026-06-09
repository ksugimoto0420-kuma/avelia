import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";

export default async function ShippingListPage() {
  await requireAdminPage("OPERATOR");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">発送リスト</h1>
      <Card>
        <CardHeader
          title="発送リスト CSV"
          subtitle="物販を含む支払済注文の配送先・商品明細"
        />
        <CardBody>
          <Button href="/api/admin/exports/shipping-list">
            発送リスト CSV をダウンロード
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
