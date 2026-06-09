"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

/**
 * サイン済みファイルを特定の納品（注文明細ユニット）に紐づけて READY 化する。
 * アップロードは行(deliveryId)に対してのみ行うため、誰のものか取り違えが起きない。
 */
export async function markDeliveryReady(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const deliveryId = formData.get("deliveryId") as string;
  const fileKey = formData.get("fileKey") as string;
  const originalFilename = (formData.get("originalFilename") as string) || null;
  if (!deliveryId || !fileKey) throw new AppError("入力が不正です", 400);

  const delivery = await prisma.digitalDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      user: { select: { email: true, name: true } },
      order: { select: { orderNumber: true } },
      digitalContent: { select: { title: true, viewLimitDays: true } },
    },
  });
  if (!delivery) throw new AppError("納品が見つかりません", 404);

  const wasPending = delivery.status === "PENDING";
  const now = new Date();
  const expiresAt = delivery.digitalContent.viewLimitDays
    ? new Date(
        now.getTime() +
          delivery.digitalContent.viewLimitDays * 24 * 60 * 60 * 1000,
      )
    : null;

  await prisma.digitalDelivery.update({
    where: { id: deliveryId },
    data: {
      fileKey,
      originalFilename,
      status: "READY",
      deliveredAt: now,
      expiresAt,
      downloadCount: 0,
    },
  });

  await logOperation({
    adminUserId: admin.id,
    action: wasPending ? "digital_delivery.ready" : "digital_delivery.reupload",
    targetType: "DigitalDelivery",
    targetId: deliveryId,
    detail: { orderNumber: delivery.order.orderNumber, fileKey },
  });

  // 初回 READY 化のときのみ購入者へ通知（差し替えでは再送しない）
  if (wasPending) {
    await sendMail({
      to: delivery.user.email,
      subject: "【Avelia FunClub】サイン入りコンテンツの準備ができました",
      text: `${delivery.user.name ?? "お客"}様\n\nご注文 ${delivery.order.orderNumber} の「${delivery.digitalContent.title}」（宛名: ${delivery.nickname ?? "-"}）のサイン入りコンテンツの準備ができました。\n\nマイページ（ログイン後）の「デジタルコンテンツ」からダウンロードいただけます。\n${env.appUrl}/mypage/digital-contents`,
    });
  }

  revalidatePath("/admin/digital-deliveries");
}

/** 納品を取消し PENDING に戻す（差し替え準備）。成果物キーをクリア。 */
export async function cancelDelivery(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const deliveryId = formData.get("deliveryId") as string;
  if (!deliveryId) throw new AppError("入力が不正です", 400);

  await prisma.digitalDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "PENDING",
      fileKey: null,
      originalFilename: null,
      deliveredAt: null,
      expiresAt: null,
    },
  });

  await logOperation({
    adminUserId: admin.id,
    action: "digital_delivery.cancel",
    targetType: "DigitalDelivery",
    targetId: deliveryId,
  });

  revalidatePath("/admin/digital-deliveries");
}
