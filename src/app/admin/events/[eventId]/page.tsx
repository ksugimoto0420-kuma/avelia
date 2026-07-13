import Link from "next/link";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/admin/EventForm";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { deleteEvent } from "../actions";
import { EventCancelButton } from "./EventCancelButton";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const { eventId } = await params;
  const [event, artists] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      include: {
        products: {
          include: {
            variants: { select: { _count: { select: { orderItems: true } } } },
          },
        },
      },
    }),
    prisma.artist.findMany({
      where: { isPublished: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!event) notFound();

  const orderCount = event.products.reduce(
    (sum, p) =>
      sum + p.variants.reduce((s, v) => s + v._count.orderItems, 0),
    0,
  );
  const canDelete = orderCount === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">イベント編集</h1>
        <div className="flex items-center gap-2">
          {/* #4: 関連注文を見る */}
          <Button
            href={`/admin/orders?eventId=${event.id}&month=all`}
            variant="outline"
            size="sm"
          >
            📦 関連注文を見る
          </Button>
          <Button
            href={`/admin/products?eventId=${event.id}`}
            variant="outline"
            size="sm"
          >
            商品を管理（{event.products.length}）
          </Button>
        </div>
      </div>
      <EventForm event={event} artists={artists} />
      <p className="text-right text-sm">
        <Link href={`/events/${event.id}`} className="text-gray-400 hover:underline">
          公開ページを見る ↗
        </Link>
      </p>

      {/* #42: 開催中止フロー。対象注文があるときのみ意味があるので表示条件をつける */}
      {orderCount > 0 && (
        <Card className="border-red-200">
          <CardHeader title="開催中止" />
          <CardBody className="space-y-3">
            <p className="text-sm text-gray-600">
              対象の支払済注文 ({orderCount} 件) を Stripe で全額返金し、
              イベントを非公開化、対象ファンに開催中止メールを送信します。
              確認モーダルで対象件数と返金総額をプレビューできます。
            </p>
            <EventCancelButton eventId={event.id} eventTitle={event.title} />
          </CardBody>
        </Card>
      )}

      <Card className="border-red-200">
        <CardHeader title="削除" />
        <CardBody className="space-y-3">
          {canDelete ? (
            <>
              <p className="text-sm text-gray-600">
                このイベントには注文がありません。削除すると、紐づく商品（{event.products.length}件）・バリアント・在庫も含めて完全に削除されます。
              </p>
              <form action={deleteEvent}>
                <input type="hidden" name="id" value={event.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  このイベントを削除する
                </button>
              </form>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              このイベントには {orderCount} 件の注文があるため削除できません。販売を終了する場合は「非公開」に切り替えるか、上の「開催中止」から一括返金してください。
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
