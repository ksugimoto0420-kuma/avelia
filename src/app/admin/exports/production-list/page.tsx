import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProductionListPage() {
  await requireAdminPage("OPERATOR");
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">制作リスト</h1>
      <Card>
        <CardHeader
          title="制作リスト CSV"
          subtitle="支払済注文の明細（ニックネーム・読み仮名・備考を含む）"
        />
        <CardBody className="space-y-4">
          <Button href="/api/admin/exports/production-list">
            全件 CSV をダウンロード
          </Button>
          <div className="border-t border-gray-100 pt-4">
            <p className="mb-2 text-sm font-medium text-gray-700">
              イベントで絞り込み
            </p>
            <div className="flex flex-wrap gap-2">
              {events.map((e) => (
                <Button
                  key={e.id}
                  href={`/api/admin/exports/production-list?eventId=${e.id}`}
                  variant="outline"
                  size="sm"
                >
                  {e.title}
                </Button>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
