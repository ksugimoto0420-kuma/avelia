import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FilterBar, FilterField, FilterSelect, FilterText } from "@/components/admin/Filters";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminLotteriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status ?? "";
  const page = Math.max(1, Number(sp.page ?? "1"));

  const where: Prisma.LotteryWhereInput = {};
  if (status) where.status = status as Prisma.LotteryWhereInput["status"];
  if (q)
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { product: { name: { contains: q, mode: "insensitive" } } },
      { event: { title: { contains: q, mode: "insensitive" } } },
      { event: { artistName: { contains: q, mode: "insensitive" } } },
    ];

  const [lotteries, total] = await Promise.all([
    prisma.lottery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        product: { select: { name: true } },
        event: { select: { title: true, artistName: true } },
        _count: { select: { entries: true } },
      },
    }),
    prisma.lottery.count({ where }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildHref = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q, status, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/admin/lotteries?${qs}` : "/admin/lotteries";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">抽選管理</h1>
          <p className="text-sm text-gray-500">
            当選者のみが対象商品を購入できます（仕様書 9）。抽選実行は確認後に行われます。
          </p>
        </div>
        <Button href="/admin/lotteries/new">＋ 新規抽選</Button>
      </div>

      <FilterBar action="/admin/lotteries" clearHref="/admin/lotteries">
        <FilterField label="キーワード">
          <FilterText name="q" defaultValue={q} placeholder="抽選名・商品・出演者" />
        </FilterField>
        <FilterField label="状態">
          <FilterSelect
            name="status"
            defaultValue={status}
            options={[
              { value: "", label: "すべて" },
              { value: "DRAFT", label: "下書き" },
              { value: "OPEN", label: "受付中" },
              { value: "CLOSED", label: "締切" },
              { value: "DRAWN", label: "抽選済" },
            ]}
          />
        </FilterField>
      </FilterBar>

      <Card>
        <CardBody className="space-y-4">
          <p className="text-sm text-gray-500">{total} 件中 {lotteries.length} 件を表示</p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 text-left">抽選名</th>
                  <th className="px-4 py-3 text-left">対象商品 / 出演者</th>
                  <th className="px-4 py-3 text-right">応募</th>
                  <th className="px-4 py-3 text-right">当選枠</th>
                  <th className="px-4 py-3 text-left">状態</th>
                  <th className="px-4 py-3 text-left">購入期限</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lotteries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                      該当する抽選がありません
                    </td>
                  </tr>
                ) : (
                  lotteries.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/admin/lotteries/${l.id}`}
                          className="text-brand-600 hover:underline"
                        >
                          {l.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p>{l.product?.name ?? "-"}</p>
                        <p className="text-xs text-gray-400">
                          {l.event?.artistName ?? l.event?.title ?? ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">{l._count.entries}</td>
                      <td className="px-4 py-3 text-right">{l.winnersCount}</td>
                      <td className="px-4 py-3">
                        <StatusBadge kind="lottery" status={l.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDateTime(l.purchaseDeadlineAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {/* 抽選操作は詳細ページの「抽選実施」タブで行う。
                            一覧からは導線として「実施画面を開く」リンクを提示するだけにする。 */}
                        <Link
                          href={`/admin/lotteries/${l.id}/draw`}
                          className={
                            "inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium " +
                            (l.status === "DRAWN"
                              ? "border-gray-200 text-gray-500"
                              : "border-brand-600 bg-brand-50 text-brand-700 hover:bg-brand-100")
                          }
                        >
                          {l.status === "DRAWN" ? "結果を見る" : "抽選実施"}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => buildHref({ page: String(p) })} />
        </CardBody>
      </Card>
    </div>
  );
}
