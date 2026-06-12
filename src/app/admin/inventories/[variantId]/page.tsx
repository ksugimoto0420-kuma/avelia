import type { AdjustmentReason } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, type BadgeColor } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { adjustInventory, setLowStockThreshold } from "../actions";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<AdjustmentReason, string> = {
  INITIAL: "初期登録",
  RESTOCK: "再入荷",
  LOSS: "ロス",
  RETURN: "返品入庫",
  STOCKTAKE: "棚卸",
  CORRECTION: "訂正",
  CSV_IMPORT: "CSV取込",
  OTHER: "その他",
};
const REASON_COLOR: Record<AdjustmentReason, BadgeColor> = {
  INITIAL: "gray",
  RESTOCK: "green",
  LOSS: "red",
  RETURN: "blue",
  STOCKTAKE: "purple",
  CORRECTION: "yellow",
  CSV_IMPORT: "blue",
  OTHER: "gray",
};

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ variantId: string }>;
}) {
  await requireAdminPage();
  const { variantId } = await params;

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      inventory: true,
      product: { include: { event: true } },
    },
  });
  if (!variant || !variant.inventory) notFound();

  const adjustments = await prisma.inventoryAdjustment.findMany({
    where: { variantId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const adminIds = Array.from(
    new Set(adjustments.map((a) => a.adminUserId).filter((id): id is string => !!id)),
  );
  const admins = adminIds.length
    ? await prisma.adminUser.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const adminMap = new Map(admins.map((a) => [a.id, a]));

  const inv = variant.inventory;
  const available = inv.quantity - inv.reserved - inv.sold;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/inventories"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 在庫一覧に戻る
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{variant.product.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {variant.product.event.title} / {variant.name}（{variant.sku}）
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-gray-500">総在庫</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{inv.quantity}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-gray-500">仮確保</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">{inv.reserved}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-gray-500">販売済</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{inv.sold}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-gray-500">残数</p>
            <p
              className={`mt-1 text-2xl font-bold ${available <= 0 ? "text-red-600" : available <= 10 ? "text-yellow-600" : "text-green-600"}`}
            >
              {available}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="在庫を調整" />
        <CardBody>
          <form action={adjustInventory} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input type="hidden" name="variantId" value={variant.id} />
            <div>
              <label className={labelCls}>新しい在庫数 *</label>
              <input
                type="number"
                name="quantity"
                defaultValue={inv.quantity}
                min={0}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>理由 *</label>
              <select name="reason" defaultValue="CORRECTION" className={inputCls}>
                <option value="RESTOCK">再入荷</option>
                <option value="LOSS">ロス</option>
                <option value="RETURN">返品入庫</option>
                <option value="STOCKTAKE">棚卸</option>
                <option value="CORRECTION">訂正</option>
                <option value="OTHER">その他</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>メモ</label>
              <input
                name="note"
                placeholder="例: 7月入荷分追加"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-4 flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                在庫を更新する
              </button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="低在庫アラート" />
        <CardBody>
          <form
            action={setLowStockThreshold}
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="variantId" value={variant.id} />
            <div>
              <label className={labelCls}>
                残数がこれ以下になったらアラート（空欄=通知しない）
              </label>
              <input
                type="number"
                name="threshold"
                defaultValue={inv.lowStockThreshold ?? ""}
                min={0}
                placeholder="例: 5"
                className={`${inputCls} w-32`}
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              保存
            </button>
            {inv.lowStockAlertedAt && (
              <p className="text-xs text-gray-500">
                直近通知：{formatDateTime(inv.lowStockAlertedAt)}
              </p>
            )}
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="調整履歴"
          subtitle={`直近 ${adjustments.length} 件`}
        />
        <CardBody className="px-0 py-0">
          {adjustments.length === 0 ? (
            <p className="px-5 py-10 text-center text-gray-400">
              まだ調整履歴はありません
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 text-left">日時</th>
                  <th className="px-4 py-3 text-left">理由</th>
                  <th className="px-4 py-3 text-right">前</th>
                  <th className="px-4 py-3 text-right">→</th>
                  <th className="px-4 py-3 text-right">後</th>
                  <th className="px-4 py-3 text-right">差分</th>
                  <th className="px-4 py-3 text-left">操作者 / メモ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {adjustments.map((a) => {
                  const admin = a.adminUserId
                    ? adminMap.get(a.adminUserId)
                    : null;
                  return (
                    <tr key={a.id}>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDateTime(a.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={REASON_COLOR[a.reason]}>
                          {REASON_LABEL[a.reason]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">{a.before}</td>
                      <td className="px-4 py-3 text-right text-gray-400">→</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {a.after}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${a.delta > 0 ? "text-green-600" : a.delta < 0 ? "text-red-600" : "text-gray-400"}`}
                      >
                        {a.delta > 0 ? `+${a.delta}` : a.delta}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <p>{admin?.name ?? "-"}</p>
                        {a.note && <p className="text-gray-500">{a.note}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
