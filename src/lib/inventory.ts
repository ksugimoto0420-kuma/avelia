import type { Prisma } from "@prisma/client";

// 在庫ロジック（仕様書 6. 在庫確保ロジック）
//
// inventory.quantity = 総在庫
// inventory.reserved = 仮確保中（決済前）
// inventory.sold     = 販売済み
// 利用可能在庫 available = quantity - reserved - sold
//
// オーバーセル防止のため、確保・確定は必ずトランザクション内で
// 行ロック相当（SELECT ... FOR UPDATE）を取ってから更新する。

export function availableStock(inv: {
  quantity: number;
  reserved: number;
  sold: number;
}): number {
  return inv.quantity - inv.reserved - inv.sold;
}

/**
 * トランザクション内で在庫行を排他ロックし、利用可能数を返す。
 * variantId 単位。存在しなければ null。
 */
export async function lockInventory(
  tx: Prisma.TransactionClient,
  variantId: string,
): Promise<{
  id: string;
  quantity: number;
  reserved: number;
  sold: number;
  available: number;
} | null> {
  const rows = await tx.$queryRaw<
    Array<{ id: string; quantity: number; reserved: number; sold: number }>
  >`SELECT id, quantity, reserved, sold FROM inventories WHERE "variantId" = ${variantId} FOR UPDATE`;
  const inv = rows[0];
  if (!inv) return null;
  return { ...inv, available: availableStock(inv) };
}

/**
 * 在庫を仮確保する（reserved += quantity）。
 * 利用可能数が足りなければ false を返す（呼び出し側で在庫不足エラーに）。
 * 必ずトランザクション内で呼ぶこと。
 */
export async function reserveStock(
  tx: Prisma.TransactionClient,
  variantId: string,
  quantity: number,
): Promise<boolean> {
  const inv = await lockInventory(tx, variantId);
  if (!inv) return false;
  if (inv.available < quantity) return false;
  await tx.inventory.update({
    where: { id: inv.id },
    data: { reserved: { increment: quantity } },
  });
  return true;
}

/**
 * 仮確保を確定する（reserved -= quantity, sold += quantity）。
 * 決済成功 Webhook 時に呼ぶ。
 */
export async function confirmStock(
  tx: Prisma.TransactionClient,
  variantId: string,
  quantity: number,
): Promise<void> {
  const inv = await lockInventory(tx, variantId);
  if (!inv) return;
  await tx.inventory.update({
    where: { id: inv.id },
    data: {
      reserved: { decrement: Math.min(quantity, inv.reserved) },
      sold: { increment: quantity },
    },
  });
}

/**
 * 仮確保を解放する（reserved -= quantity）。
 * 決済キャンセル・期限切れ時に呼ぶ。
 */
export async function releaseStock(
  tx: Prisma.TransactionClient,
  variantId: string,
  quantity: number,
): Promise<void> {
  const inv = await lockInventory(tx, variantId);
  if (!inv) return;
  await tx.inventory.update({
    where: { id: inv.id },
    data: { reserved: { decrement: Math.min(quantity, inv.reserved) } },
  });
}
