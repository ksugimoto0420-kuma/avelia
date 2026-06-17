import { notFound } from "next/navigation";
import { LotteryForm } from "@/components/admin/LotteryForm";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { deleteLottery } from "../actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "抽選編集 | 管理" };

const ENTRY_STATUS: Record<
  string,
  { label: string; color: "yellow" | "green" | "gray" | "purple" | "red" }
> = {
  ENTERED: { label: "応募中", color: "yellow" },
  WON: { label: "当選", color: "green" },
  LOST: { label: "落選", color: "gray" },
  PURCHASED: { label: "購入済", color: "purple" },
  EXPIRED: { label: "期限切れ", color: "red" },
};

export default async function EditLotteryPage({
  params,
}: {
  params: Promise<{ lotteryId: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const { lotteryId } = await params;

  const [lottery, events, products, entries] = await Promise.all([
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
    prisma.lotteryEntry.findMany({
      where: { lotteryId },
      orderBy: [{ status: "asc" }, { enteredAt: "asc" }],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);
  if (!lottery) notFound();

  const canDelete = lottery.status !== "DRAWN" && lottery._count.entries === 0;

  const winners = entries.filter(
    (e) => e.status === "WON" || e.status === "PURCHASED" || e.status === "EXPIRED",
  );
  const losers = entries.filter((e) => e.status === "LOST");
  const pending = entries.filter((e) => e.status === "ENTERED");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">抽選編集</h1>
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

      <Card>
        <CardHeader
          title="応募・当選者一覧"
          subtitle={
            lottery.status === "DRAWN"
              ? `応募 ${entries.length} 名 / 当選 ${winners.length} 名 / 落選 ${losers.length} 名`
              : `応募 ${entries.length} 名（抽選未実行）`
          }
        />
        <CardBody className="space-y-6">
          {entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
              まだ応募はありません
            </p>
          ) : (
            <>
              {lottery.status === "DRAWN" && winners.length > 0 && (
                <EntrySection
                  title="当選者"
                  rows={winners}
                />
              )}
              {lottery.status === "DRAWN" && losers.length > 0 && (
                <EntrySection
                  title="落選者"
                  rows={losers}
                />
              )}
              {pending.length > 0 && (
                <EntrySection
                  title={lottery.status === "DRAWN" ? "未判定" : "応募中"}
                  rows={pending}
                />
              )}
            </>
          )}
        </CardBody>
      </Card>

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

type EntryRow = {
  id: string;
  status: string;
  enteredAt: Date;
  wonAt: Date | null;
  purchaseDeadlineAt: Date | null;
  orderId: string | null;
  user: { id: string; name: string | null; email: string };
};

function EntrySection({ title, rows }: { title: string; rows: EntryRow[] }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-bold text-gray-700">
        {title}（{rows.length} 名）
      </h4>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">ユーザー</th>
              <th className="px-3 py-2 text-left">状態</th>
              <th className="px-3 py-2 text-left">応募日時</th>
              <th className="px-3 py-2 text-left">当選日時</th>
              <th className="px-3 py-2 text-left">購入期限</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((e) => {
              const conf = ENTRY_STATUS[e.status] ?? { label: e.status, color: "gray" as const };
              return (
                <tr key={e.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900">
                      {e.user.name ?? "(名前未登録)"}
                    </p>
                    <p className="text-xs text-gray-500">{e.user.email}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={conf.color}>{conf.label}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {formatDateTime(e.enteredAt)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {e.wonAt ? formatDateTime(e.wonAt) : "-"}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {e.purchaseDeadlineAt ? formatDateTime(e.purchaseDeadlineAt) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
