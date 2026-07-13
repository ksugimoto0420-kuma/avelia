"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { sendSignatureReadyMail } from "@/lib/mail/sendSignatureReadyMail";
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
    await sendSignatureReadyMail(deliveryId);
  }

  revalidatePath("/admin/digital-deliveries");
}

/**
 * サインを承認して納品確定。
 * モックでは合成は表示時に行うため、fileKey に `signature:<sigId>` を入れて
 * DigitalDelivery.READY 化し、Signature.status を COMPLETED に。
 */
export async function approveSignature(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const deliveryId = formData.get("deliveryId") as string;
  if (!deliveryId) throw new AppError("入力が不正です", 400);

  const delivery = await prisma.digitalDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      signature: true,
      user: { select: { email: true, name: true } },
      order: { select: { orderNumber: true } },
      digitalContent: { select: { title: true, viewLimitDays: true } },
    },
  });
  if (!delivery) throw new AppError("納品が見つかりません", 404);
  if (!delivery.signature || delivery.signature.status !== "WRITTEN") {
    throw new AppError("承認可能なサインがありません", 409);
  }

  const now = new Date();
  const expiresAt = delivery.digitalContent.viewLimitDays
    ? new Date(
        now.getTime() +
          delivery.digitalContent.viewLimitDays * 24 * 60 * 60 * 1000,
      )
    : null;
  const fileKey = `signature:${delivery.signature.id}`;

  await prisma.$transaction([
    prisma.signature.update({
      where: { id: delivery.signature.id },
      data: { status: "COMPLETED", composedAt: now },
    }),
    prisma.digitalDelivery.update({
      where: { id: deliveryId },
      data: {
        fileKey,
        originalFilename: `${delivery.order.orderNumber}_${delivery.nickname ?? "宛名なし"}.png`,
        status: "READY",
        deliveredAt: now,
        expiresAt,
        downloadCount: 0,
      },
    }),
  ]);

  await logOperation({
    adminUserId: admin.id,
    action: "signature.approve",
    targetType: "DigitalDelivery",
    targetId: deliveryId,
  });

  // #39: 写真/動画で本文を分岐する統一テンプレートで送信
  await sendSignatureReadyMail(deliveryId);

  revalidatePath("/admin/digital-deliveries");
}

/** サインを却下＝書き直し依頼。Signature を REJECTED に。 */
export async function rejectSignature(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const deliveryId = formData.get("deliveryId") as string;
  const reason = (formData.get("reason") as string | null)?.trim() || null;
  if (!deliveryId) throw new AppError("入力が不正です", 400);

  const delivery = await prisma.digitalDelivery.findUnique({
    where: { id: deliveryId },
    include: { signature: true },
  });
  if (!delivery?.signature) throw new AppError("サインがありません", 404);

  await prisma.signature.update({
    where: { id: delivery.signature.id },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectReason: reason,
    },
  });

  await logOperation({
    adminUserId: admin.id,
    action: "signature.reject",
    targetType: "DigitalDelivery",
    targetId: deliveryId,
    detail: { reason },
  });

  revalidatePath("/admin/digital-deliveries");
}

/**
 * #39: サイン完了メールを手動で再送する。
 * 送信失敗時のリカバリ、顧客からの「届いていない」問い合わせ対応用。
 * DigitalDelivery が READY でない場合はエラー。
 */
export async function resendSignatureReadyMail(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const deliveryId = formData.get("deliveryId") as string;
  if (!deliveryId) throw new AppError("入力が不正です", 400);

  const delivery = await prisma.digitalDelivery.findUnique({
    where: { id: deliveryId },
    select: { status: true },
  });
  if (!delivery) throw new AppError("納品が見つかりません", 404);
  if (delivery.status !== "READY") {
    throw new AppError("納品が完了していません", 409);
  }

  await sendSignatureReadyMail(deliveryId);

  await logOperation({
    adminUserId: admin.id,
    action: "signature.mail.resend",
    targetType: "DigitalDelivery",
    targetId: deliveryId,
  });

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
