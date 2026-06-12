import Link from "next/link";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/admin/EventForm";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { deleteEvent } from "../actions";

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">イベント編集</h1>
        <Button
          href={`/admin/products?eventId=${event.id}`}
          variant="outline"
          size="sm"
        >
          商品を管理（{event.products.length}）
        </Button>
      </div>
      <EventForm event={event} artists={artists} />
      <p className="text-right text-sm">
        <Link href={`/events/${event.id}`} className="text-gray-400 hover:underline">
          公開ページを見る ↗
        </Link>
      </p>

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
              このイベントには {orderCount} 件の注文があるため削除できません。販売を終了する場合は「非公開」に切り替えてください。
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
