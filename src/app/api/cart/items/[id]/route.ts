import { AppError, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/guards";
import { getCartView } from "@/lib/cart";
import { availableStock } from "@/lib/inventory";
import { normalizeUnitNicknames } from "@/lib/nickname";
import { prisma } from "@/lib/prisma";
import { updateCartItemSchema } from "@/lib/validators";

async function loadOwnedItem(userId: string, itemId: string) {
  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { cart: true, variant: { include: { inventory: true } } },
  });
  if (!item || item.cart.userId !== userId) {
    throw new AppError("カート項目が見つかりません", 404);
  }
  return item;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();
    const { quantity, nickname, nicknameKana, note, unitNicknames } =
      updateCartItemSchema.parse(body);

    const item = await loadOwnedItem(user.id, id);
    const nextQty = quantity ?? item.quantity;
    if (quantity != null) {
      const available = item.variant.inventory
        ? availableStock(item.variant.inventory)
        : 0;
      if (quantity > available) {
        throw new AppError("在庫が不足しています", 409);
      }
    }

    // 数量・ニックネームのいずれかが変わったら配列を数量に合わせて再正規化
    const touchesNickname =
      unitNicknames !== undefined ||
      nickname !== undefined ||
      nicknameKana !== undefined ||
      note !== undefined ||
      quantity !== undefined;
    const units = touchesNickname
      ? normalizeUnitNicknames(unitNicknames ?? item.unitNicknames, nextQty, {
          nickname: nickname ?? item.nickname,
          nicknameKana: nicknameKana ?? item.nicknameKana,
          note: note ?? item.note,
        })
      : null;

    await prisma.cartItem.update({
      where: { id },
      data: {
        quantity: quantity ?? undefined,
        ...(units
          ? {
              unitNicknames: units,
              nickname: units[0]?.nickname ?? null,
              nicknameKana: units[0]?.nicknameKana ?? null,
              note: units[0]?.note ?? null,
            }
          : {}),
      },
    });
    return ok(await getCartView(user.id));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await loadOwnedItem(user.id, id);
    await prisma.cartItem.delete({ where: { id } });
    return ok(await getCartView(user.id));
  } catch (err) {
    return handleError(err);
  }
}
