import { AppError, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/guards";
import { getCartView } from "@/lib/cart";
import { createPendingOrder, type CheckoutItemInput } from "@/lib/order";
import { prisma } from "@/lib/prisma";
import { checkoutSchema } from "@/lib/validators";

/**
 * カート内容から PENDING 注文を作成し、在庫を仮確保する。
 * 数量はカートを正本とし、body.items は宛名/ニックネーム等の付加情報のみ採用。
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const input = checkoutSchema.parse(body);

    const cart = await getCartView(user.id);
    if (cart.items.length === 0) {
      throw new AppError("カートが空です", 400);
    }
    if (!cart.purchasable) {
      throw new AppError("購入できない商品がカートに含まれています", 409);
    }

    // 宛名・ニックネームはカート投入時に保存済み。body で上書きも可能。
    const extra = new Map(
      (input.items ?? []).map((i) => [i.variantId, i]),
    );

    const items: CheckoutItemInput[] = cart.items.map((ci) => {
      const e = extra.get(ci.variantId);
      return {
        variantId: ci.variantId,
        quantity: ci.quantity,
        nickname: ci.nickname ?? e?.nickname ?? null,
        nicknameKana: ci.nicknameKana ?? e?.nicknameKana ?? null,
        note: ci.note ?? e?.note ?? null,
        // カートに保存済みの数量分ニックネームを引き継ぐ
        unitNicknames: ci.unitNicknames,
      };
    });

    const order = await createPendingOrder({
      userId: user.id,
      items,
      recipient: {
        recipientName: input.recipientName,
        recipientKana: input.recipientKana,
        recipientPhone: input.recipientPhone,
        recipientPostal: input.recipientPostal,
        recipientAddress: input.recipientAddress,
        shippingMethod: input.shippingMethod,
      },
    });

    // 注文確定したのでカートを空にする
    await prisma.cartItem.deleteMany({ where: { cart: { userId: user.id } } });

    return ok(
      { orderId: order.id, orderNumber: order.orderNumber, total: order.total },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
