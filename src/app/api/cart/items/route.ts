import { AppError, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/guards";
import { getCartView, getOrCreateCart } from "@/lib/cart";
import { availableStock } from "@/lib/inventory";
import { normalizeUnitNicknames } from "@/lib/nickname";
import { prisma } from "@/lib/prisma";
import { addCartItemSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { variantId, quantity, nickname, nicknameKana, note, unitNicknames } =
      addCartItemSchema.parse(body);

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { inventory: true, product: true },
    });
    if (!variant) throw new AppError("商品が見つかりません", 404);
    // ニックネームはカートページでも入力・編集できるため、投入時は任意とする。
    // 必須チェックは注文確定時（/api/orders）に行う。

    const cart = await getOrCreateCart(user.id);

    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    const nextQty = (existing?.quantity ?? 0) + quantity;

    // 在庫上限と1注文上限を超えないようガード（仮確保は決済時に実施）
    const available = variant.inventory
      ? availableStock(variant.inventory)
      : 0;
    if (nextQty > available) {
      throw new AppError("在庫が不足しています", 409);
    }
    if (
      variant.product.maxPerOrder != null &&
      nextQty > variant.product.maxPerOrder
    ) {
      throw new AppError(
        `この商品は1注文あたり${variant.product.maxPerOrder}個までです`,
        409,
      );
    }

    // 数量分のニックネームを正規化（既存があれば引き継ぎ、単一入力を先頭に補完）
    const units = normalizeUnitNicknames(
      existing?.unitNicknames ?? unitNicknames,
      nextQty,
      { nickname, nicknameKana, note },
    );

    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      create: {
        cartId: cart.id,
        variantId,
        quantity,
        nickname: units[0]?.nickname ?? null,
        nicknameKana: units[0]?.nicknameKana ?? null,
        note: units[0]?.note ?? null,
        unitNicknames: units,
      },
      // 同一商品の再投入時はニックネームを最新の入力で更新
      update: {
        quantity: nextQty,
        nickname: units[0]?.nickname ?? null,
        nicknameKana: units[0]?.nicknameKana ?? null,
        note: units[0]?.note ?? null,
        unitNicknames: units,
      },
    });

    const view = await getCartView(user.id);
    return ok(view, 201);
  } catch (err) {
    return handleError(err);
  }
}
