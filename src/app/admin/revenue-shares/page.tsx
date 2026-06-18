import { RevenueShareRunForm } from "@/components/admin/RevenueShareRunForm";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { currentJstPeriod, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminRevenueSharesPage() {
  await requireAdminPage("MANAGER");

  const defaultPeriod = currentJstPeriod();

  const shares = await prisma.revenueShare.findMany({
    orderBy: [{ period: "desc" }, { computedAt: "desc" }],
    take: 200,
    include: { event: { select: { title: true } } },
  });
  const currentPeriod = shares[0]?.period ?? null;

  type Row = (typeof shares)[number];
  const columns: Column<Row>[] = [
    { key: "period", header: "期間" },
    { key: "event", header: "イベント", cell: (s) => s.event?.title ?? "-" },
    {
      key: "gross",
      header: "総売上",
      align: "right",
      cell: (s) => formatYen(s.grossSales),
    },
    {
      key: "rate",
      header: "弊社率",
      align: "right",
      cell: (s) => `${Math.round(s.ourShareRate * 100)}%`,
    },
    {
      key: "our",
      header: "弊社取り分",
      align: "right",
      cell: (s) => formatYen(s.ourAmount),
    },
    {
      key: "avelia",
      header: "Avelia取り分",
      align: "right",
      cell: (s) => formatYen(s.aveliaAmount),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">R/S 売上集計</h1>

      <Card>
        <CardHeader
          title="月次集計の実行"
          subtitle="決済完了・未返金の注文を対象にイベント別集計します"
        />
        <CardBody>
          <RevenueShareRunForm defaultPeriod={defaultPeriod} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="集計結果"
          subtitle={
            currentPeriod
              ? `${currentPeriod} の集計結果を表示しています（実行ごとに上書きされます）`
              : "まだ集計が実行されていません"
          }
        />
        <CardBody>
          <DataTable
            columns={columns}
            rows={shares}
            emptyMessage="集計結果がありません。上のフォームから集計を実行してください。"
          />
        </CardBody>
      </Card>
    </div>
  );
}
