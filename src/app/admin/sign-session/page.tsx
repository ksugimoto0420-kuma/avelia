import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "サイン記入セッション" };

export default async function SignSessionEntryPage() {
  await requireAdminPage("OPERATOR");

  // 未記入 or REJECTED の納品をイベントごとに集計
  const groups = await prisma.$queryRaw<
    Array<{
      eventId: string;
      eventTitle: string;
      artistName: string | null;
      pendingCount: number;
      firstDeliveryId: string;
    }>
  >`
    SELECT
      e.id AS "eventId",
      e.title AS "eventTitle",
      e."artistName" AS "artistName",
      COUNT(dd.id)::int AS "pendingCount",
      (
        SELECT dd2.id FROM digital_deliveries dd2
        JOIN digital_contents dc2 ON dc2.id = dd2."digitalContentId"
        JOIN products p2 ON p2.id = dc2."productId"
        WHERE p2."eventId" = e.id
          AND dd2.status = 'PENDING'
          AND NOT EXISTS (
            SELECT 1 FROM signatures s
            WHERE s."deliveryId" = dd2.id
              AND s.status = 'WRITTEN'
          )
        ORDER BY dd2."createdAt" ASC
        LIMIT 1
      ) AS "firstDeliveryId"
    FROM digital_deliveries dd
    JOIN digital_contents dc ON dc.id = dd."digitalContentId"
    JOIN products p ON p.id = dc."productId"
    JOIN events e ON e.id = p."eventId"
    LEFT JOIN signatures s ON s."deliveryId" = dd.id
    WHERE dd.status = 'PENDING'
      AND (s.id IS NULL OR s.status = 'REJECTED')
    GROUP BY e.id, e.title, e."artistName"
    ORDER BY "pendingCount" DESC
  `;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            サイン記入セッション
          </h1>
          <p className="text-sm text-gray-500">
            出演者がタブレットで直接サインを書く画面に進みます。
            イベント単位で順次サイン待ちの宛先が表示されます。
          </p>
        </div>
        <Button
          href="/admin/sign-session/demo"
          variant="outline"
          size="sm"
        >
          🎨 デモを試す
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-12 text-center text-gray-400">
              現在サイン待ちの納品はありません
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <Card key={g.eventId}>
              <CardHeader
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge color="yellow">サイン待ち {g.pendingCount}件</Badge>
                    {g.eventTitle}
                  </span>
                }
                subtitle={g.artistName ?? undefined}
                action={
                  <Button
                    href={`/admin/sign-session/${g.firstDeliveryId}`}
                    size="sm"
                  >
                    記入開始 →
                  </Button>
                }
              />
            </Card>
          ))}
        </div>
      )}

      <div className="text-right">
        <Link
          href="/admin/digital-deliveries"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          納品管理に戻る →
        </Link>
      </div>
    </div>
  );
}
