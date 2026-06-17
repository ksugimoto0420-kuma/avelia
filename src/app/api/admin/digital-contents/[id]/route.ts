import { AppError, handleError, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z
  .object({
    productId: z.string().optional().nullable(),
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    type: z.enum(["IMAGE", "VIDEO", "AUDIO", "FILE"]),
    deliveryType: z.enum(["SHARED", "PERSONALIZED"]).default("SHARED"),
    fileKey: z.string().optional().nullable(),
    baseImageKey: z.string().optional().nullable(),
    baseImageUrl: z.string().url().optional().nullable().or(z.literal("")),
    publishAt: z.string().datetime().optional().nullable(),
    viewLimitDays: z.number().int().min(1).optional().nullable(),
    downloadLimit: z.number().int().min(1).optional().nullable(),
  })
  .refine(
    (d) =>
      d.deliveryType === "SHARED"
        ? !!d.fileKey
        : !!d.baseImageKey || !!d.baseImageUrl,
    {
      message:
        "SHAREDは配信ファイル、PERSONALIZEDは原本（アップロード or URL）が必要です",
      path: ["fileKey"],
    },
  );

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin("OPERATOR");
    const { id } = await params;
    const input = schema.parse(await req.json());

    const existing = await prisma.digitalContent.findUnique({ where: { id } });
    if (!existing) throw new AppError("コンテンツが見つかりません", 404);

    await prisma.digitalContent.update({
      where: { id },
      data: {
        productId: input.productId || null,
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        deliveryType: input.deliveryType,
        fileKey: input.fileKey ?? null,
        baseImageKey: input.baseImageKey ?? null,
        baseImageUrl: input.baseImageUrl || null,
        publishAt: input.publishAt ? new Date(input.publishAt) : null,
        viewLimitDays: input.viewLimitDays ?? null,
        downloadLimit: input.downloadLimit ?? null,
      },
    });

    await logOperation({
      adminUserId: admin.id,
      action: "digital_content.update",
      targetType: "DigitalContent",
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

    const existing = await prisma.digitalContent.findUnique({
      where: { id },
      include: {
        _count: {
          select: { userGrants: true, deliveries: true },
        },
      },
    });
    if (!existing) throw new AppError("コンテンツが見つかりません", 404);

    if (existing._count.userGrants > 0 || existing._count.deliveries > 0) {
      throw new AppError(
        "このコンテンツは既にユーザーに付与/納品されています。削除できません。",
        409,
      );
    }

    await prisma.digitalContent.delete({ where: { id } });

    await logOperation({
      adminUserId: admin.id,
      action: "digital_content.delete",
      targetType: "DigitalContent",
      targetId: id,
      detail: { title: existing.title },
    });

    return ok({ id });
  } catch (err) {
    return handleError(err);
  }
}
