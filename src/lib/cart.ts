import { availableStock } from "@/lib/inventory";
import { allUnitsFilled, normalizeUnitNicknames } from "@/lib/nickname";
import { prisma } from "@/lib/prisma";
import { getSaleStatus } from "@/lib/sale";
import {
  calculateShippingFee,
  getSettingInt,
} from "@/lib/settings";

/** ユーザーのカートを取得（無ければ作成）。 */
export async function getOrCreateCart(userId: string) {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.cart.create({ data: { userId } });
}

/** カート内容を表示用に整形して返す。 */
export async function getCartView(userId: string) {
  const cart = await getOrCreateCart(userId);
  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { createdAt: "asc" },
    include: {
      variant: {
        include: {
          inventory: true,
          product: { include: { event: true } },
        },
      },
    },
  });

  const now = new Date();
  const viewItems = items.map((item) => {
    const v = item.variant;
    const p = v.product;
    const e = p.event;
    const available = v.inventory ? availableStock(v.inventory) : 0;
    const saleStartAt = p.saleStartAt ?? e.saleStartAt;
    const saleEndAt = p.saleEndAt ?? e.saleEndAt;
    const status = getSaleStatus(
      {
        isPublished: p.isPublished && e.isPublished,
        saleStartAt,
        saleEndAt,
        available,
      },
      now,
    );
    const units = normalizeUnitNicknames(item.unitNicknames, item.quantity, {
      nickname: item.nickname,
      nicknameKana: item.nicknameKana,
      note: item.note,
    });
    // 宛名必須SKUは全ユニット入力済みで初めて購入可
    const nicknameSatisfied = !v.requiresNickname || allUnitsFilled(units);
    return {
      id: item.id,
      variantId: v.id,
      productId: p.id,
      productName: p.name,
      variantName: v.name,
      imageUrl: p.imageUrl,
      type: p.type,
      requiresNickname: v.requiresNickname,
      nicknameNote: p.nicknameNote,
      nickname: item.nickname,
      nicknameKana: item.nicknameKana,
      note: item.note,
      unitNicknames: units,
      nicknameSatisfied,
      unitPrice: v.price,
      quantity: item.quantity,
      available,
      saleStatus: status,
      purchasable: status === "ON_SALE",
      lineTotal: v.price * item.quantity,
    };
  });

  const subtotal = viewItems.reduce((s, i) => s + i.lineTotal, 0);
  const physicalSubtotal = viewItems
    .filter((i) => i.type === "PHYSICAL")
    .reduce((s, i) => s + i.lineTotal, 0);
  const hasPhysical = viewItems.some((i) => i.type === "PHYSICAL");
  const shippingFee = await calculateShippingFee({
    physicalSubtotal,
    hasPhysical,
  });
  const shippingFreeThreshold = await getSettingInt("shippingFreeThreshold");
  const shippingAmountForFree =
    hasPhysical && shippingFreeThreshold > 0 && physicalSubtotal < shippingFreeThreshold
      ? shippingFreeThreshold - physicalSubtotal
      : 0;
  const total = subtotal + shippingFee;

  return {
    cartId: cart.id,
    items: viewItems,
    subtotal,
    shippingFee,
    shippingAmountForFree,
    total,
    purchasable:
      viewItems.length > 0 &&
      viewItems.every((i) => i.purchasable && i.nicknameSatisfied),
  };
}
