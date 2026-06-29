import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { KujiResultClient } from "./KujiResultClient";

export const dynamic = "force-dynamic";

export default async function KujiResultPage({
  params,
}: {
  params: Promise<{ campaignId: string; orderId: string }>;
}) {
  const user = await requireUser();
  const { campaignId, orderId } = await params;

  const [campaign, draws, order] = await Promise.all([
    prisma.kujiCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, title: true },
    }),
    prisma.kujiDraw.findMany({
      where: { campaignId, orderId, userId: user.id },
      orderBy: [{ isBundleBonus: "asc" }, { drawnAt: "asc" }],
      include: {
        prize: {
          select: { rank: true, name: true, imageUrl: true, variantNote: true },
        },
      },
    }),
    prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, userId: true, total: true },
    }),
  ]);
  if (!campaign || !order || order.userId !== user.id) notFound();

  return (
    <KujiResultClient
      campaignTitle={campaign.title}
      campaignId={campaign.id}
      orderNumber={order.orderNumber}
      draws={draws.map((d) => ({
        id: d.id,
        prize: {
          rank: d.prize.rank,
          name: d.prize.name,
          imageUrl: d.prize.imageUrl,
          variantNote: d.prize.variantNote,
        },
        isBundleBonus: d.isBundleBonus,
      }))}
    />
  );
}
