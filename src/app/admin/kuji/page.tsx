import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  FilterBar,
  FilterField,
  FilterSelect,
  FilterText,
} from "@/components/admin/Filters";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "アベリアくじ管理" };

const PAGE_SIZE = 20;

export default async function AdminKujiListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status ?? "";
  const page = Math.max(1, Number(sp.page ?? "1"));

  const where: Prisma.KujiCampaignWhereInput = {};
  if (status)
    where.status = status as Prisma.KujiCampaignWhereInput["status"];
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { artist: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [campaigns, total] = await Promise.all([
    prisma.kujiCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        artist: { select: { name: true } },
        _count: { select: { prizes: true, bundles: true, draws: true } },
      },
    }),
    prisma.kujiCampaign.count({ where }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildHref = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q, status, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/admin/kuji?${qs}` : "/admin/kuji";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            アベリアくじ管理
          </h1>
          <p className="text-sm text-gray-500">
            オンラインガチャ型の販売。1回ごとに即時抽選し、当選賞品は実品で配送します。
          </p>
        </div>
        <Button href="/admin/kuji/new">＋ 新規くじ</Button>
      </div>

      <FilterBar action="/admin/kuji" clearHref="/admin/kuji">
        <FilterField label="キーワード">
          <FilterText
            name="q"
            defaultValue={q}
            placeholder="タイトル・出演者"
          />
        </FilterField>
        <FilterField label="状態">
          <FilterSelect
            name="status"
            defaultValue={status}
            options={[
              { value: "", label: "すべて" },
              { value: "DRAFT", label: "下書き" },
              { value: "OPEN", label: "販売中" },
              { value: "CLOSED", label: "終了" },
            ]}
          />
        </FilterField>
      </FilterBar>

      <Card>
        <CardBody className="space-y-4">
          <p className="text-sm text-gray-500">
            {total} 件中 {campaigns.length} 件を表示
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 text-left">タイトル</th>
                  <th className="px-4 py-3 text-left">出演者</th>
                  <th className="px-4 py-3 text-right">単価</th>
                  <th className="px-4 py-3 text-right">賞 / SKU / 抽選</th>
                  <th className="px-4 py-3 text-left">期間</th>
                  <th className="px-4 py-3 text-left">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-gray-400"
                    >
                      該当するくじがありません
                    </td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/admin/kuji/${c.id}`}
                          className="text-brand-600 hover:underline"
                        >
                          {c.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p>{c.artist?.name ?? "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatYen(c.pricePerDraw)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-600">
                        賞 {c._count.prizes} / SKU {c._count.bundles} /
                        抽選 {c._count.draws}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDateTime(c.saleStartAt)}
                        <br />〜 {formatDateTime(c.saleEndAt)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge kind="kuji" status={c.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(p) => buildHref({ page: String(p) })}
          />
        </CardBody>
      </Card>
    </div>
  );
}
