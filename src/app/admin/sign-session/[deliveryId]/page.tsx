import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { SignSession } from "./SignSession";

export const dynamic = "force-dynamic";

export const metadata = { title: "サイン記入" };

export default async function SignSessionPage({
  params,
}: {
  params: Promise<{ deliveryId: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const { deliveryId } = await params;

  const delivery = await prisma.digitalDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      digitalContent: {
        select: {
          title: true,
          baseImageKey: true,
          baseImageUrl: true,
          // DigitalContent 自身が紐づく商品（PERSONALIZED 配信元）
          product: {
            select: {
              imageUrl: true,
              event: { select: { id: true, title: true } },
            },
          },
        },
      },
      // 注文明細から実際に購入された商品（フォールバック用）
      orderItem: {
        select: {
          productName: true,
          quantity: true,
          variant: {
            select: {
              product: {
                select: {
                  imageUrl: true,
                  event: { select: { id: true, title: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!delivery) notFound();

  // ステータスPENDINGの未記入分のみ対象（既にREADYならエラー）
  if (delivery.status === "READY") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-gray-500">この納品は既に完了しています。</p>
      </div>
    );
  }

  // 次の未記入納品（同じイベント内、Signatureなし or REJECTEDなもの）
  const productEventId =
    delivery.digitalContent.product?.event.id ??
    delivery.orderItem.variant.product.event.id;
  const next = await prisma.digitalDelivery.findFirst({
    where: {
      status: "PENDING",
      id: { not: deliveryId },
      OR: [
        { signature: { is: null } },
        { signature: { status: "REJECTED" } },
      ],
      ...(productEventId
        ? { digitalContent: { product: { eventId: productEventId } } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  // 残り件数（同イベント、未記入 or REJECTED）
  const pendingCount = await prisma.digitalDelivery.count({
    where: {
      status: "PENDING",
      OR: [
        { signature: { is: null } },
        { signature: { status: "REJECTED" } },
      ],
      ...(productEventId
        ? { digitalContent: { product: { eventId: productEventId } } }
        : {}),
    },
  });

  // 背景に出す原本画像URL（優先順位）：
  // 1. DigitalContent.baseImageUrl （外部URL・MVPモック・運用での明示指定）
  // 2. DigitalContent.baseImageKey （ローカルストレージ）
  // 3. DigitalContent.product.imageUrl （DigitalContentが紐づく商品）
  // 4. orderItem.variant.product.imageUrl （実際に購入された商品）
  const baseImageUrl =
    delivery.digitalContent.baseImageUrl ??
    (delivery.digitalContent.baseImageKey
      ? `/api/admin/deliveries/base-image/${encodeURIComponent(delivery.digitalContent.baseImageKey)}`
      : null) ??
    delivery.digitalContent.product?.imageUrl ??
    delivery.orderItem.variant.product.imageUrl ??
    null;

  const eventTitle =
    delivery.digitalContent.product?.event.title ??
    delivery.orderItem.variant.product.event.title ??
    "イベント";
  const unitLabel =
    delivery.orderItem.quantity >= 2
      ? `${delivery.unitIndex + 1}/${delivery.orderItem.quantity}個目`
      : "";

  return (
    <SignSession
      deliveryId={delivery.id}
      nickname={delivery.nickname}
      productName={delivery.orderItem.productName}
      eventTitle={eventTitle}
      unitLabel={unitLabel}
      baseImageUrl={baseImageUrl}
      pendingCount={pendingCount}
      nextDeliveryId={next?.id ?? null}
    />
  );
}
