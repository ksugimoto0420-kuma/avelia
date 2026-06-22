import Link from "next/link";
import { notFound } from "next/navigation";
import { LotteryForm } from "@/components/admin/LotteryForm";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { deleteLottery } from "../actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "抽選編集 | 管理" };

/**
 * 抽選の「編集」ページ。
 * 抽選実施（指名・抽選実行・応募者確認）は別ページ /admin/lotteries/[id]/draw に
 * 分離されており、ここからリンクで遷移する。
 *
 * このページの責務:
 *   - 抽選情報の編集（タイトル・期間・当選枠など）
 *   - 削除（応募0件かつ未抽選のみ）
 */
export default async function EditLotteryPage({
  params,
}: {
  params: Promise<{ lotteryId: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const { lotteryId } = await params;

  const [lottery, events, products] = await Promise.all([
    prisma.lottery.findUnique({
      where: { id: lotteryId },
      include: { _count: { select: { entries: true } } },
    }),
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
  if (!lottery) notFound();

  const canDelete = lottery.status !== "DRAWN" && lottery._count.entries === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/lotteries"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← 抽選一覧
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">抽選編集</h1>
        </div>
        <Link
          href={`/admin/lotteries/${lottery.id}/draw`}
          className="rounded-lg border border-brand-600 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700 hover:bg-brand-100"
        >
          {lottery.status === "DRAWN" ? "結果を見る" : "抽選実施画面を開く"} →
        </Link>
      </div>

      <LotteryForm
        initial={{
          id: lottery.id,
          title: lottery.title,
          description: lottery.description,
          eventId: lottery.eventId,
          productId: lottery.productId,
          entryStartAt: lottery.entryStartAt,
          entryEndAt: lottery.entryEndAt,
          purchaseDeadlineAt: lottery.purchaseDeadlineAt,
          winnersCount: lottery.winnersCount,
          status: lottery.status,
        }}
        events={events.map((e) => ({
          id: e.id,
          label: e.artistName ? `${e.artistName} / ${e.title}` : e.title,
        }))}
        products={products.map((p) => ({
          id: p.id,
          label: `${p.event.title} / ${p.name}`,
        }))}
      />

      <Card className="border-red-200">
        <CardHeader title="削除" />
        <CardBody className="space-y-3">
          {canDelete ? (
            <>
              <p className="text-sm text-gray-600">
                この抽選にはまだ応募がなく、抽選も実行されていません。削除できます。
              </p>
              <form action={deleteLottery}>
                <input type="hidden" name="id" value={lottery.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  この抽選を削除する
                </button>
              </form>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              {lottery.status === "DRAWN"
                ? "抽選実行済みのため削除できません。"
                : `${lottery._count.entries}件の応募があるため削除できません。`}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
