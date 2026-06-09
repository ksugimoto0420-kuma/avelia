import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatYen } from "@/lib/utils";
import { runRevenueShare } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminRevenueSharesPage() {
  await requireAdminPage("MANAGER");

  const shares = await prisma.revenueShare.findMany({
    orderBy: [{ period: "desc" }, { computedAt: "desc" }],
    take: 200,
    include: { event: { select: { title: true } } },
  });

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
          <form action={runRevenueShare} className="flex items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                対象期間（YYYY-MM）
              </label>
              <input
                name="period"
                placeholder="2026-06"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              集計を実行
            </button>
            <a
              href="/api/admin/exports/revenue-shares"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              CSV出力
            </a>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="集計結果" />
        <CardBody>
          <DataTable columns={columns} rows={shares} emptyMessage="集計結果がありません" />
        </CardBody>
      </Card>
    </div>
  );
}
