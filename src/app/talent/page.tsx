import { Prisma } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireTalentPage } from "@/lib/auth/talent-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "サイン待ち一覧 | Avelia for Talent" };

export default async function TalentHomePage() {
  const me = await requireTalentPage();

  // タレントが TALENT で artist 未割当の場合はアサイン待ち画面を表示
  if (me.role === "TALENT" && !me.assignedArtistId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <CardHeader title="担当アーティストが未設定です" />
          <CardBody className="space-y-3 text-sm text-gray-700">
            <p>
              アカウントは作成されていますが、まだ担当アーティストが
              割り当てられていません。運営にご連絡いただくか、
              管理者の設定をお待ちください。
            </p>
            <p className="text-xs text-gray-400">
              管理者: /admin/admins から該当アカウントに artist を設定して
              ください。
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  // TALENT は自分のアーティスト配下のみ、管理者は全件閲覧（テスト用）
  const artistFilter =
    me.role === "TALENT" && me.assignedArtistId
      ? { artistId: me.assignedArtistId }
      : {};

  // 自分宛のサイン待ち（PENDING で signature が未作成 or REJECTED）をイベント単位で集計
  // #70: 写真 / 動画 の内訳もあわせて返す (productKind 別カウント)。
  const groups = await prisma.$queryRaw<
    Array<{
      eventId: string;
      eventTitle: string;
      artistName: string | null;
      pendingCount: number;
      photoCount: number;
      videoCount: number;
      firstDeliveryId: string;
    }>
  >`
    SELECT
      e.id AS "eventId",
      e.title AS "eventTitle",
      e."artistName" AS "artistName",
      COUNT(dd.id)::int AS "pendingCount",
      SUM(CASE WHEN p."productKind" = 'DIGITAL_PHOTO_SIGN' THEN 1 ELSE 0 END)::int AS "photoCount",
      SUM(CASE WHEN p."productKind" = 'DIGITAL_VIDEO_SIGN' THEN 1 ELSE 0 END)::int AS "videoCount",
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
      ${
        // タレントの artist で絞る（管理者プレビュー時は無条件）
        artistFilter.artistId
          ? Prisma.sql`AND e."artistId" = ${artistFilter.artistId}`
          : Prisma.empty
      }
    GROUP BY e.id, e.title, e."artistName"
    ORDER BY "pendingCount" DESC
  `;

  const artistName = me.assignedArtist?.name ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">サイン待ち一覧</h1>
        <p className="text-sm text-gray-500">
          {artistName
            ? `${artistName} さんへのご注文・サイン待ちの一覧です。`
            : "サイン待ちのご注文一覧です。"}
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-16 text-center text-gray-400">
              現在サイン待ちのご注文はありません ✨
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Link
              key={g.eventId}
              href={`/talent/sign/${g.firstDeliveryId}`}
              className="block"
            >
              {/* タブレットで押しやすい大きめのタッチ領域。カード全体がタップ対象。 */}
              <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color="yellow">サイン待ち {g.pendingCount}件</Badge>
                    {g.photoCount > 0 && (
                      <Badge color="blue">📷 写真 {g.photoCount}件</Badge>
                    )}
                    {g.videoCount > 0 && (
                      <Badge color="purple">🎬 動画 {g.videoCount}件</Badge>
                    )}
                  </div>
                  <p className="text-lg font-bold text-gray-900 sm:text-xl">
                    {g.eventTitle}
                  </p>
                  {g.artistName && (
                    <p className="text-sm text-gray-500">{g.artistName}</p>
                  )}
                </div>
                <span
                  className="inline-flex h-14 shrink-0 items-center justify-center rounded-xl bg-brand-600 px-6 text-base font-bold text-white shadow sm:h-16 sm:px-8 sm:text-lg"
                  role="button"
                >
                  記入開始 →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
  );
}
