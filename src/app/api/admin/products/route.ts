import { handleError, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";
import { parseJstDateTimeLocal } from "@/lib/utils";
import { productInputSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin("OPERATOR");
    const input = productInputSchema.parse(await req.json());

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          eventId: input.eventId,
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          type: input.type,
          basePrice: input.basePrice,
          imageUrl: input.imageUrl ?? null,
          benefit: input.benefit ?? null,
          deliveryDate: input.deliveryDate ? parseJstDateTimeLocal(input.deliveryDate) : null,
          notes: input.notes ?? null,
          nicknameNote: input.nicknameNote ?? null,
          isPublished: input.isPublished ?? false,
          saleStartAt: input.saleStartAt ? parseJstDateTimeLocal(input.saleStartAt) : null,
          saleEndAt: input.saleEndAt ? parseJstDateTimeLocal(input.saleEndAt) : null,
          maxPerOrder: input.maxPerOrder ?? null,
          maxPerUser: input.maxPerUser ?? null,
          lotteryOnly: input.lotteryOnly ?? false,
          // 商品レベルのフラグは「いずれかのSKUが必須」を表す集計値
          requiresNickname: input.variants.some((v) => v.requiresNickname),
        },
      });

      for (const v of input.variants) {
        await tx.productVariant.create({
          data: {
            productId: created.id,
            name: v.name,
            sku: v.sku,
            price: v.price,
            isDefault: v.isDefault ?? false,
            requiresNickname: v.requiresNickname ?? false,
            inventory: { create: { quantity: v.quantity } },
          },
        });
      }
      return created;
    });

    await logOperation({
      adminUserId: admin.id,
      action: "product.create",
      targetType: "Product",
      targetId: product.id,
    });

    return ok({ id: product.id }, 201);
  } catch (err) {
    return handleError(err);
  }
}
