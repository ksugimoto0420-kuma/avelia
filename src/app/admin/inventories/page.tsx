import { Prisma } from "@prisma/client";
import Link from "next/link";
import { FilterBar, FilterField, FilterSelect, FilterText } from "@/components/admin/Filters";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { EVENT_TYPE_LABEL } from "@/lib/event-meta";
import { prisma } from "@/lib/prisma";
import { adjustInventory } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type InvRow = {
  id: string;
  quantity: number;
  reserved: number;
  sold: number;
  available: number;
  lowStockThreshold: number | null;
  variantId: string;
  variantName: string;
  sku: string;
  productId: string;
  productName: string;
  productPublished: boolean;
  eventTitle: string;
  eventPublished: boolean;
  eventEnded: boolean;
};

export default async function AdminInventoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const stock = sp.stock ?? "";
  const eventType = sp.eventType ?? "";
  const visibility = sp.visibility ?? "";
  const page = Math.max(1, Number(sp.page ?? "1"));
  const offset = (page - 1) * PAGE_SIZE;

  // 動的 WHERE を安全に組み立て
  const conds: Prisma.Sql[] = [];
  if (q) {
    const like = `%${q}%`;
    conds.push(
      Prisma.sql`(p.name ILIKE ${like} OR pv.name ILIKE ${like} OR pv.sku ILIKE ${like})`,
    );
  }
  if (eventType) conds.push(Prisma.sql`e."eventType"::text = ${eventType}`);
  if (stock === "in_stock")
    conds.push(Prisma.sql`(i.quantity - i.reserved - i.sold) > 10`);
  else if (stock === "low")
    conds.push(Prisma.sql`(i.quantity - i.reserved - i.sold) BETWEEN 1 AND 10`);
  else if (stock === "soldout")
    conds.push(Prisma.sql`(i.quantity - i.reserved - i.sold) <= 0`);
  else if (stock === "below_threshold")
    // SKU 個別に設定されている閾値 (lowStockThreshold) 以下のもの
    conds.push(
      Prisma.sql`i."lowStockThreshold" IS NOT NULL AND (i.quantity - i.reserved - i.sold) <= i."lowStockThreshold"`,
    );
  // 公開状態の絞り込み
  if (visibility === "public") {
    conds.push(
      Prisma.sql`p."isPublished" = true AND e."isPublished" = true AND (e."saleEndAt" IS NULL OR e."saleEndAt" >= NOW())`,
    );
  } else if (visibility === "draft") {
    conds.push(Prisma.sql`(p."isPublished" = false OR e."isPublished" = false)`);
  } else if (visibility === "ended") {
    conds.push(
      Prisma.sql`e."saleEndAt" IS NOT NULL AND e."saleEndAt" < NOW()`,
    );
  }
  const whereSql = conds.length
    ? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}`
    : Prisma.empty;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<InvRow[]>`
      SELECT i.id, i.quantity, i.reserved, i.sold,
             (i.quantity - i.reserved - i.sold) AS available,
             i."lowStockThreshold",
             pv.id AS "variantId", pv.name AS "variantName", pv.sku,
             p.id AS "productId", p.name AS "productName",
             p."isPublished" AS "productPublished",
             e.title AS "eventTitle",
             e."isPublished" AS "eventPublished",
             (e."saleEndAt" IS NOT NULL AND e."saleEndAt" < NOW()) AS "eventEnded"
      FROM inventories i
      JOIN product_variants pv ON pv.id = i."variantId"
      JOIN products p ON p.id = pv."productId"
      JOIN events e ON e.id = p."eventId"
      ${whereSql}
      ORDER BY (i.quantity - i.reserved - i.sold) ASC, p.name ASC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM inventories i
      JOIN product_variants pv ON pv.id = i."variantId"
      JOIN products p ON p.id = pv."productId"
      JOIN events e ON e.id = p."eventId"
      ${whereSql}`,
  ]);
  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildHref = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q, stock, eventType, visibility, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/admin/inventories?${qs}` : "/admin/inventories";
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">在庫管理</h1>

      <FilterBar action="/admin/inventories" clearHref="/admin/inventories">
        <FilterField label="キーワード">
          <FilterText name="q" defaultValue={q} placeholder="商品名・SKU・種類" />
        </FilterField>
        <FilterField label="在庫状態">
          <FilterSelect
            name="stock"
            defaultValue={stock}
            className="w-48"
            options={[
              { value: "", label: "すべて" },
              { value: "below_threshold", label: "閾値以下（アラート対象）" },
              { value: "in_stock", label: "在庫あり(11+)" },
              { value: "low", label: "残少(1〜10)" },
              { value: "soldout", label: "売切(0)" },
            ]}
          />
        </FilterField>
        <FilterField label="種別">
          <FilterSelect
            name="eventType"
            defaultValue={eventType}
            options={[
              { value: "", label: "すべて" },
              { value: "MEET_GREET", label: EVENT_TYPE_LABEL.MEET_GREET },
              { value: "KUJI", label: EVENT_TYPE_LABEL.KUJI },
              { value: "TRADING_CARD", label: EVENT_TYPE_LABEL.TRADING_CARD },
              { value: "GOODS", label: EVENT_TYPE_LABEL.GOODS },
            ]}
          />
        </FilterField>
        <FilterField label="公開状態">
          <FilterSelect
            name="visibility"
            defaultValue={visibility}
            className="w-40"
            options={[
              { value: "", label: "すべて" },
              { value: "public", label: "公開中" },
              { value: "draft", label: "非公開" },
              { value: "ended", label: "販売終了" },
            ]}
          />
        </FilterField>
      </FilterBar>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {total} 件中 {rows.length} 件を表示
            </p>
            <div className="flex gap-2">
              <Button href="/admin/inventories/import" variant="outline" size="sm">
                CSV取込
              </Button>
              <Button
                href="/api/admin/exports/inventories"
                variant="outline"
                size="sm"
              >
                CSV出力
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 text-left">商品 / バリエーション</th>
                  <th className="px-4 py-3 text-left">公開</th>
                  <th className="px-4 py-3 text-right">総在庫</th>
                  <th className="px-4 py-3 text-right">仮確保</th>
                  <th className="px-4 py-3 text-right">販売済</th>
                  <th className="px-4 py-3 text-right">残数</th>
                  <th className="px-4 py-3 text-left">在庫調整</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                      該当する在庫がありません
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    // 整合性警告
                    const warnings: string[] = [];
                    if (!r.productPublished) warnings.push("商品が非公開");
                    if (!r.eventPublished) warnings.push("イベントが非公開");
                    if (r.eventEnded) warnings.push("販売終了済み");
                    if (
                      r.lowStockThreshold != null &&
                      r.available <= r.lowStockThreshold &&
                      r.available > 0
                    ) {
                      warnings.push(`閾値(${r.lowStockThreshold})到達`);
                    }
                    return (
                      <tr key={r.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/inventories/${r.variantId}`}
                            className="font-medium text-brand-600 hover:underline"
                          >
                            {r.productName}
                          </Link>
                          <p className="text-xs text-gray-400">
                            {r.eventTitle} / {r.variantName}（{r.sku}）
                          </p>
                          {warnings.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {warnings.map((w) => (
                                <Badge key={w} color="yellow">
                                  ⚠ {w}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.eventEnded ? (
                            <Badge color="gray">販売終了</Badge>
                          ) : !r.eventPublished ? (
                            <Badge color="gray">イベント非公開</Badge>
                          ) : !r.productPublished ? (
                            <Badge color="gray">商品非公開</Badge>
                          ) : (
                            <Badge color="green">公開中</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">{r.quantity}</td>
                        <td className="px-4 py-3 text-right text-yellow-600">
                          {r.reserved}
                        </td>
                        <td className="px-4 py-3 text-right">{r.sold}</td>
                        <td className="px-4 py-3 text-right">
                          {r.available <= 0 ? (
                            <Badge color="red">売切</Badge>
                          ) : r.available <= 10 ? (
                            <Badge color="yellow">{r.available}</Badge>
                          ) : (
                            <Badge color="green">{r.available}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <form
                            action={adjustInventory}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input
                              type="hidden"
                              name="variantId"
                              value={r.variantId}
                            />
                            <input
                              type="number"
                              name="quantity"
                              defaultValue={r.quantity}
                              min={0}
                              aria-label="新しい在庫数"
                              className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm"
                            />
                            <select
                              name="reason"
                              defaultValue="CORRECTION"
                              aria-label="調整理由"
                              className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                            >
                              <option value="RESTOCK">再入荷</option>
                              <option value="LOSS">ロス</option>
                              <option value="RETURN">返品入庫</option>
                              <option value="STOCKTAKE">棚卸</option>
                              <option value="CORRECTION">訂正</option>
                              <option value="OTHER">その他</option>
                            </select>
                            <input
                              name="note"
                              placeholder="メモ"
                              aria-label="メモ"
                              className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-xs"
                            />
                            <button
                              type="submit"
                              className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                            >
                              更新
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })
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
