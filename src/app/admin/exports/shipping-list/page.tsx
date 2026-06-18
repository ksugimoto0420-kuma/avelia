import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";

export const dynamic = "force-dynamic";

export const metadata = { title: "発送リスト" };

const SECTIONS: {
  title: string;
  subtitle: string;
  source: "all" | "in_house" | "warehouse";
}[] = [
  {
    title: "すべての発送対象",
    subtitle: "手元出荷・倉庫出荷を区別せずすべて出力します",
    source: "all",
  },
  {
    title: "手元出荷分のみ",
    subtitle: "ポストカード等、社内で印字・発送する商品",
    source: "in_house",
  },
  {
    title: "倉庫出荷分のみ（新潟・佐川）",
    subtitle: "倉庫に在庫を持っている商品（写真集・雑誌など）",
    source: "warehouse",
  },
];

export default async function ShippingListPage() {
  await requireAdminPage("OPERATOR");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">発送リスト</h1>
        <p className="text-sm text-gray-500">
          物販を含む支払済注文を CSV で出力します。発送元と形式を選んで
          ダウンロードしてください。倉庫システムへの連携は CSV を手動で
          取り込んで運用する想定です。
        </p>
      </div>

      {SECTIONS.map((s) => (
        <Card key={s.source}>
          <CardHeader title={s.title} subtitle={s.subtitle} />
          <CardBody className="flex flex-wrap gap-3">
            <Button
              href={`/api/admin/exports/shipping-list?source=${s.source}`}
              variant="outline"
            >
              標準形式 CSV
            </Button>
            <Button
              href={`/api/admin/exports/shipping-list?source=${s.source}&format=yamato`}
            >
              ヤマトB2形式 CSV
            </Button>
          </CardBody>
        </Card>
      ))}

      <p className="text-xs text-gray-400">
        ※ ヤマトB2形式は一般的な「B2クラウド 入力データ規格」の代表項目
        （お客様管理番号・送り状種類・お届け先・ご依頼主・品名 等）を
        含んでいます。実運用時の細かい列順は B2 のマスタ仕様に合わせて
        調整します。
      </p>
    </div>
  );
}
