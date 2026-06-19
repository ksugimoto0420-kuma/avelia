import { handleError, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z
  .object({
    productId: z.string().optional().nullable(),
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    type: z.enum(["IMAGE", "FILE"]),
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

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin("OPERATOR");
    const input = schema.parse(await req.json());

    const content = await prisma.digitalContent.create({
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
      action: "digital_content.create",
      targetType: "DigitalContent",
      targetId: content.id,
    });

    return ok({ id: content.id }, 201);
  } catch (err) {
    return handleError(err);
  }
}
