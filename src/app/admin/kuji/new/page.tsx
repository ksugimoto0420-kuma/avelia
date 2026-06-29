import { KujiCampaignForm } from "@/components/admin/KujiCampaignForm";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "新規アベリアくじ" };

export default async function NewKujiPage() {
  await requireAdminPage("OPERATOR");
  const [events, artists] = await Promise.all([
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, artistName: true },
    }),
    prisma.artist.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, name: true },
    }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">新規アベリアくじ</h1>
      <KujiCampaignForm
        events={events.map((e) => ({
          id: e.id,
          label: e.artistName ? `${e.artistName} / ${e.title}` : e.title,
        }))}
        artists={artists.map((a) => ({ id: a.id, label: a.name }))}
      />
    </div>
  );
}
