import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { InvoiceBatchPanel } from "./InvoiceBatchPanel";

export const dynamic = "force-dynamic";

export const metadata = { title: "納品書 一括DL" };

export default async function InvoiceExportPage() {
  await requireAdminPage("OPERATOR");
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, artistName: true },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">納品書 一括DL</h1>
        <p className="text-sm text-gray-500">
          支払済の注文を対象に、納品書 PDF を一括で書き出します。
          ZIP は1件ずつの PDF、連結PDF は1ファイルにまとまります。
          件数が多いと数十秒かかることがあります。
        </p>
      </div>
      <Card>
        <CardHeader title="フィルター" />
        <CardBody>
          <InvoiceBatchPanel
            events={events.map((e) => ({
              id: e.id,
              label: e.artistName ? `${e.artistName} / ${e.title}` : e.title,
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}
