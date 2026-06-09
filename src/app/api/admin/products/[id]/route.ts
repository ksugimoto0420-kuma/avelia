import { AppError, handleError, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";
import { productInputSchema } from "@/lib/validators";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin("OPERATOR");
    const { id } = await params;
    const input = productInputSchema.parse(await req.json());

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError("商品が見つかりません", 404);

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          eventId: input.eventId,
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          type: input.type,
          basePrice: input.basePrice,
          imageUrl: input.imageUrl ?? null,
          benefit: input.benefit ?? null,
          deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : null,
          notes: input.notes ?? null,
          nicknameNote: input.nicknameNote ?? null,
          isPublished: input.isPublished ?? false,
          saleStartAt: input.saleStartAt ? new Date(input.saleStartAt) : null,
          saleEndAt: input.saleEndAt ? new Date(input.saleEndAt) : null,
          maxPerOrder: input.maxPerOrder ?? null,
          maxPerUser: input.maxPerUser ?? null,
          lotteryOnly: input.lotteryOnly ?? false,
          // 商品レベルのフラグは「いずれかのSKUが必須」を表す集計値
          requiresNickname: input.variants.some((v) => v.requiresNickname),
        },
      });

      for (const v of input.variants) {
        if (v.id) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              name: v.name,
              sku: v.sku,
              price: v.price,
              isDefault: v.isDefault ?? false,
              requiresNickname: v.requiresNickname ?? false,
            },
          });
          // 在庫の総数のみ更新（reserved/sold は維持）
          await tx.inventory.upsert({
            where: { variantId: v.id },
            create: { variantId: v.id, quantity: v.quantity },
            update: { quantity: v.quantity },
          });
        } else {
          await tx.productVariant.create({
            data: {
              productId: id,
              name: v.name,
              sku: v.sku,
              price: v.price,
              isDefault: v.isDefault ?? false,
              requiresNickname: v.requiresNickname ?? false,
              inventory: { create: { quantity: v.quantity } },
            },
          });
        }
      }
    });

    await logOperation({
      adminUserId: admin.id,
      action: "product.update",
      targetType: "Product",
      targetId: id,
    });

    return ok({ id });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin("MANAGER");
    const { id } = await params;

    const existing = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            variants: true,
            lotteries: true,
            digitalContents: true,
          },
        },
        variants: {
          select: {
            _count: { select: { orderItems: true, cartItems: true } },
          },
        },
      },
    });
    if (!existing) throw new AppError("商品が見つかりません", 404);

    const hasOrders = existing.variants.some((v) => v._count.orderItems > 0);
    if (hasOrders) {
      throw new AppError(
        "注文履歴がある商品は削除できません。非公開にしてください。",
        409,
      );
    }

    await prisma.product.delete({ where: { id } });

    await logOperation({
      adminUserId: admin.id,
      action: "product.delete",
      targetType: "Product",
      targetId: id,
      detail: { name: existing.name },
    });

    return ok({ id });
  } catch (err) {
    return handleError(err);
  }
}
