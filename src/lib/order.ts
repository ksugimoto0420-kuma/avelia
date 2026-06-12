import type { Prisma } from "@prisma/client";
import { AppError } from "@/lib/api";
import { env } from "@/lib/env";
import { eventCapacityRemaining, reserveStock } from "@/lib/inventory";
import { allUnitsFilled, normalizeUnitNicknames } from "@/lib/nickname";
import { prisma } from "@/lib/prisma";
import { isPurchasable } from "@/lib/sale";
import { calculateShippingFee } from "@/lib/settings";
import { generateOrderNumber } from "@/lib/utils";

export type CheckoutItemInput = {
  variantId: string;
  quantity: number;
  nickname?: string | null;
  nicknameKana?: string | null;
  note?: string | null;
  unitNicknames?: unknown;
};

export type RecipientInput = {
  recipientName?: string | null;
  recipientKana?: string | null;
  recipientPhone?: string | null;
  recipientPostal?: string | null;
  recipientAddress?: string | null;
  shippingMethod?: string | null;
};

/** イベント内で対象ユーザーが既に支払済みの累計数量を返す。 */
async function paidQtyInEvent(
  tx: Prisma.TransactionClient,
  userId: string,
  eventId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ sum: bigint | null }>>`
    SELECT COALESCE(SUM(oi.quantity), 0) AS sum
    FROM order_items oi
    JOIN orders o ON o.id = oi."orderId"
    JOIN product_variants pv ON pv.id = oi."variantId"
    JOIN products p ON p.id = pv."productId"
    WHERE o."userId" = ${userId}
      AND o.status = 'PAID'
      AND p."eventId" = ${eventId}`;
  return Number(rows[0]?.sum ?? 0);
}

/** 商品単位で対象ユーザーが既に支払済みの累計数量を返す。 */
async function paidQtyForProduct(
  tx: Prisma.TransactionClient,
  userId: string,
  productId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ sum: bigint | null }>>`
    SELECT COALESCE(SUM(oi.quantity), 0) AS sum
    FROM order_items oi
    JOIN orders o ON o.id = oi."orderId"
    JOIN product_variants pv ON pv.id = oi."variantId"
    WHERE o."userId" = ${userId}
      AND o.status = 'PAID'
      AND pv."productId" = ${productId}`;
  return Number(rows[0]?.sum ?? 0);
}

/**
 * カート内容を検証し、在庫を仮確保して PENDING 注文を作成する。
 * すべて単一トランザクション内で実行し、オーバーセル・購入制限違反を防ぐ。
 *
 * 仕様書 6（販売機能・在庫確保）/ 9（当選者限定購入）に対応。
 */
export async function createPendingOrder(params: {
  userId: string;
  items: CheckoutItemInput[];
  recipient: RecipientInput;
  shippingFee?: number;
  now?: Date;
}) {
  const { userId, items, recipient } = params;
  const now = params.now ?? new Date();

  if (items.length === 0) {
    throw new AppError("カートが空です", 400);
  }

  const reservationExpiresAt = new Date(
    now.getTime() + env.reservationTtlMinutes * 60 * 1000,
  );

  return prisma.$transaction(async (tx) => {
    // イベント単位・商品単位の累計集計用
    const eventRequested = new Map<string, number>();
    const productRequested = new Map<string, number>();

    type Resolved = {
      input: CheckoutItemInput;
      variant: {
        id: string;
        name: string;
        price: number;
        productId: string;
      };
      product: {
        id: string;
        name: string;
        eventId: string;
        isPublished: boolean;
        saleStartAt: Date | null;
        saleEndAt: Date | null;
        maxPerOrder: number | null;
        maxPerUser: number | null;
        lotteryOnly: boolean;
      };
      event: {
        id: string;
        isPublished: boolean;
        saleStartAt: Date | null;
        saleEndAt: Date | null;
        maxPerUser: number | null;
      };
    };

    const resolved: Resolved[] = [];

    for (const item of items) {
      if (item.quantity <= 0) {
        throw new AppError("数量が不正です", 400);
      }

      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        include: { product: { include: { event: true } } },
      });
      if (!variant) {
        throw new AppError("商品が見つかりません", 404);
      }
      const product = variant.product;
      const event = product.event;

      // ニックネーム必須SKUの検証（サイン宛名）— 数量分すべて入力必須
      if (variant.requiresNickname) {
        const units = normalizeUnitNicknames(
          item.unitNicknames,
          item.quantity,
          { nickname: item.nickname, nicknameKana: item.nicknameKana, note: item.note },
        );
        if (!allUnitsFilled(units)) {
          throw new AppError(
            `「${product.name}（${variant.name}）」は数量分すべてのニックネーム（サイン宛名）の入力が必要です`,
            422,
          );
        }
      }

      // 販売期間・公開チェック（商品期間が未設定ならイベント期間に従う）
      const saleStartAt = product.saleStartAt ?? event.saleStartAt;
      const saleEndAt = product.saleEndAt ?? event.saleEndAt;
      const purchasable =
        event.isPublished &&
        isPurchasable(
          {
            isPublished: product.isPublished,
            saleStartAt,
            saleEndAt,
          },
          now,
        );
      if (!purchasable) {
        throw new AppError(
          `「${product.name}」は現在購入できません（販売期間外）`,
          409,
        );
      }

      // 当選者限定購入：WON の応募が必要
      if (product.lotteryOnly) {
        const won = await tx.lotteryEntry.findFirst({
          where: {
            userId,
            status: "WON",
            lottery: { productId: product.id },
            OR: [
              { purchaseDeadlineAt: null },
              { purchaseDeadlineAt: { gte: now } },
            ],
          },
        });
        if (!won) {
          throw new AppError(
            `「${product.name}」は当選者のみ購入できます`,
            403,
          );
        }
      }

      // 1注文あたり購入数制限
      if (product.maxPerOrder != null && item.quantity > product.maxPerOrder) {
        throw new AppError(
          `「${product.name}」は1注文あたり${product.maxPerOrder}個までです`,
          409,
        );
      }

      // 在庫仮確保
      const reserved = await reserveStock(tx, variant.id, item.quantity);
      if (!reserved) {
        throw new AppError(`「${product.name}」は在庫が不足しています`, 409);
      }

      eventRequested.set(
        event.id,
        (eventRequested.get(event.id) ?? 0) + item.quantity,
      );
      productRequested.set(
        product.id,
        (productRequested.get(product.id) ?? 0) + item.quantity,
      );

      resolved.push({
        input: item,
        variant: {
          id: variant.id,
          name: variant.name,
          price: variant.price,
          productId: product.id,
        },
        product: {
          id: product.id,
          name: product.name,
          eventId: event.id,
          isPublished: product.isPublished,
          saleStartAt: product.saleStartAt,
          saleEndAt: product.saleEndAt,
          maxPerOrder: product.maxPerOrder,
          maxPerUser: product.maxPerUser,
          lotteryOnly: product.lotteryOnly,
        },
        event: {
          id: event.id,
          isPublished: event.isPublished,
          saleStartAt: event.saleStartAt,
          saleEndAt: event.saleEndAt,
          maxPerUser: event.maxPerUser,
        },
      });
    }

    // 1ユーザー累計購入数制限（商品単位）
    for (const [productId, qty] of productRequested) {
      const r = resolved.find((x) => x.product.id === productId)!;
      const limit = r.product.maxPerUser;
      if (limit != null) {
        const past = await paidQtyForProduct(tx, userId, productId);
        if (past + qty > limit) {
          throw new AppError(
            `「${r.product.name}」の購入上限（累計${limit}個）を超えています`,
            409,
          );
        }
      }
    }

    // イベント単位の累計購入数制限
    for (const [eventId, qty] of eventRequested) {
      const r = resolved.find((x) => x.event.id === eventId)!;
      const limit = r.event.maxPerUser;
      if (limit != null) {
        const past = await paidQtyInEvent(tx, userId, eventId);
        if (past + qty > limit) {
          throw new AppError(
            `このイベントの購入上限（累計${limit}個）を超えています`,
            409,
          );
        }
      }
    }

    // イベント定員（capacity）チェック：複数商品の販売数合計に対する上限。
    // eventCapacityRemaining はこのリクエストで既に reserveStock 済みの分も
    // reserved として含めるため、その時点で残数が 0 以上であれば OK。
    for (const eventId of eventRequested.keys()) {
      const remaining = await eventCapacityRemaining(tx, eventId);
      if (remaining != null && remaining < 0) {
        const r = resolved.find((x) => x.event.id === eventId)!;
        throw new AppError(
          `「${r.product.name}」を含むイベントの参加枠（定員）が不足しています`,
          409,
        );
      }
    }

    const subtotal = resolved.reduce(
      (s, r) => s + r.variant.price * r.input.quantity,
      0,
    );

    // 物販小計と物販有無を判定して送料計算（明示引数があればそれを優先）
    const variantIds = resolved.map((r) => r.variant.id);
    const types = await tx.product.findMany({
      where: {
        variants: { some: { id: { in: variantIds } } },
      },
      select: {
        type: true,
        variants: { select: { id: true, price: true } },
      },
    });
    let physicalSubtotal = 0;
    let hasPhysical = false;
    for (const p of types) {
      if (p.type !== "PHYSICAL") continue;
      hasPhysical = true;
      for (const v of p.variants) {
        const item = resolved.find((r) => r.variant.id === v.id);
        if (!item) continue;
        physicalSubtotal += v.price * item.input.quantity;
      }
    }
    const shippingFee =
      params.shippingFee ??
      (await calculateShippingFee({ physicalSubtotal, hasPhysical }));
    const total = subtotal + shippingFee;

    // 注文・明細・仮確保レコード・決済(pending) を作成
    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(now),
        userId,
        status: "PENDING",
        currency: env.stripe.currency,
        subtotal,
        shippingFee,
        total,
        reservationExpiresAt,
        recipientName: recipient.recipientName ?? null,
        recipientKana: recipient.recipientKana ?? null,
        recipientPhone: recipient.recipientPhone ?? null,
        recipientPostal: recipient.recipientPostal ?? null,
        recipientAddress: recipient.recipientAddress ?? null,
        shippingMethod: recipient.shippingMethod ?? null,
        payment: {
          create: {
            provider: "STRIPE",
            status: "PENDING",
            amount: total,
            currency: env.stripe.currency,
          },
        },
      },
    });

    for (const r of resolved) {
      const units = normalizeUnitNicknames(
        r.input.unitNicknames,
        r.input.quantity,
        {
          nickname: r.input.nickname,
          nicknameKana: r.input.nicknameKana,
          note: r.input.note,
        },
      );
      const orderItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          variantId: r.variant.id,
          productName: r.product.name,
          variantName: r.variant.name,
          unitPrice: r.variant.price,
          quantity: r.input.quantity,
          nickname: units[0]?.nickname ?? null,
          nicknameKana: units[0]?.nicknameKana ?? null,
          note: units[0]?.note ?? null,
          unitNicknames: units,
        },
      });

      const inv = await tx.inventory.findUnique({
        where: { variantId: r.variant.id },
        select: { id: true },
      });
      if (inv) {
        await tx.stockReservation.create({
          data: {
            inventoryId: inv.id,
            quantity: r.input.quantity,
            status: "HELD",
            expiresAt: reservationExpiresAt,
            orderItemId: orderItem.id,
          },
        });
      }
    }

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, payment: true },
    });
  });
}
