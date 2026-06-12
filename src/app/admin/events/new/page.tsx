import { EventForm } from "@/components/admin/EventForm";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireAdminPage("OPERATOR");
  const artists = await prisma.artist.findMany({
    where: { isPublished: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">新規イベント</h1>
      <EventForm artists={artists} />
    </div>
  );
}
