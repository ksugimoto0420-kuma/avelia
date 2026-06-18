import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import {
  ProductionListPicker,
  type EventWithMembers,
} from "./ProductionListPicker";

export const dynamic = "force-dynamic";

export const metadata = { title: "制作リスト" };

export default async function ProductionListPage() {
  await requireAdminPage("OPERATOR");

  // イベント + 各イベント配下のバリアント名（メンバー名・サイズ等）を取得。
  // 「タレント絞り込み」用にバリアント名のユニーク一覧を作る。
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      artistName: true,
      products: {
        select: {
          variants: { select: { name: true } },
        },
      },
    },
  });

  const data: EventWithMembers[] = events.map((e) => {
    const names = new Set<string>();
    for (const p of e.products) for (const v of p.variants) names.add(v.name);
    return {
      id: e.id,
      title: e.title,
      artistName: e.artistName,
      memberNames: Array.from(names),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">制作リスト</h1>
        <p className="text-sm text-gray-500">
          支払済注文の明細（ニックネーム・読み仮名・備考）を CSV で出力します。
          イベントとタレント（メンバー）で絞り込めるため、各タレントへの
          サイン依頼分だけを抽出できます。
        </p>
      </div>

      <Card>
        <CardHeader
          title="制作リスト CSV"
          subtitle="数量分の宛名は1点1行に展開されます"
        />
        <CardBody>
          <ProductionListPicker events={data} />
        </CardBody>
      </Card>
    </div>
  );
}
