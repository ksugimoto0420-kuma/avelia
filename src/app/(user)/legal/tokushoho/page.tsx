import { Card, CardBody } from "@/components/ui/Card";

export const metadata = { title: "特定商取引法に基づく表記" };

type Row = { label: string; value: string };

const ROWS: Row[] = [
  { label: "販売事業者", value: "（運営会社名を記載）" },
  { label: "運営責任者", value: "（責任者氏名を記載）" },
  { label: "所在地", value: "（〒000-0000 ◯◯県◯◯市◯◯）" },
  { label: "電話番号", value: "（請求があれば遅滞なく開示します）" },
  { label: "メールアドレス", value: "support@example.com" },
  {
    label: "販売価格",
    value: "各商品ページに表示の価格（税込）。",
  },
  {
    label: "商品代金以外の必要料金",
    value: "送料、決済手数料（カード会社規定）、消費税。詳細は注文確認画面に表示します。",
  },
  {
    label: "お支払い方法",
    value: "クレジットカード決済（外部決済サービスを利用）。",
  },
  {
    label: "お支払い時期",
    value: "ご注文時にお支払いが確定します。",
  },
  {
    label: "商品の引渡時期",
    value:
      "サイン入り商品は、対象のオンライン特典会・サイン会開催後、各商品ページに記載の発送予定日に発送いたします。デジタル商品はご購入後マイページにて配信開始日時から閲覧・ダウンロードいただけます。",
  },
  {
    label: "返品・交換について",
    value:
      "商品の性質上、お客様都合による返品・交換はお受けできません。商品到着後7日以内に破損・初期不良が確認された場合のみ、交換または返金にて対応いたします。お問い合わせよりご連絡ください。",
  },
  {
    label: "申込の有効期限",
    value:
      "カート投入後、在庫の仮確保期限内（既定15分）にご決済を完了してください。期限切れの場合は再度カートに追加し直してください。",
  },
  {
    label: "販売数量",
    value:
      "商品・イベントごとに「1注文あたりの上限」「お一人様累計上限」を設けている場合があります。各商品ページの表示をご確認ください。",
  },
];

export default function TokushohoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900">
        特定商取引法に基づく表記
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        特定商取引に関する法律 第11条に基づき、以下のとおり表示いたします。
      </p>

      <Card className="mt-8">
        <CardBody>
          <dl className="divide-y divide-gray-100">
            {ROWS.map((r) => (
              <div
                key={r.label}
                className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4"
              >
                <dt className="text-sm font-semibold text-gray-500">
                  {r.label}
                </dt>
                <dd className="whitespace-pre-wrap text-sm text-gray-800">
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <p className="mt-6 text-xs text-gray-400">
        ※ 本表記中の「（◯◯を記載）」は本サービス公開前に運営事業者の情報に差し替えてください。
      </p>
    </div>
  );
}
