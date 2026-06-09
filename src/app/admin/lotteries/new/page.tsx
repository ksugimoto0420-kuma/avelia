import { LotteryForm } from "@/components/admin/LotteryForm";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "新規抽選 | 管理" };

export default async function NewLotteryPage() {
  await requireAdminPage("OPERATOR");

  const [events, products] = await Promise.all([
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, artistName: true },
    }),
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, name: true, event: { select: { title: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">新規抽選</h1>
      <LotteryForm
        events={events.map((e) => ({
          id: e.id,
          label: e.artistName ? `${e.artistName} / ${e.title}` : e.title,
        }))}
        products={products.map((p) => ({
          id: p.id,
          label: `${p.event.title} / ${p.name}`,
        }))}
      />
    </div>
  );
}
