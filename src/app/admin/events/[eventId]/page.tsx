import Link from "next/link";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/admin/EventForm";
import { Button } from "@/components/ui/Button";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { products: true },
  });
  if (!event) notFound();

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
      <EventForm event={event} />
      <p className="text-right text-sm">
        <Link href={`/events/${event.id}`} className="text-gray-400 hover:underline">
          公開ページを見る ↗
        </Link>
      </p>
    </div>
  );
}
