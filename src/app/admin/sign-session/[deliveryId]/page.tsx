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
          productId: true,
          // DigitalContent 自身が紐づく商品（PERSONALIZED 配信元）
          product: {
            select: {
              id: true,
              imageUrl: true,
              productKind: true,
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
                  id: true,
                  imageUrl: true,
                  productKind: true,
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

  // サイン用ベース素材のURLを解決する（優先順位）：
  // 1. DigitalContent.baseImageUrl （管理画面で明示指定）
  // 2. DigitalContent.baseImageKey （旧: ローカルストレージ）
  // 3. DigitalContent.product.imageUrl （商品画像フォールバック）
  // 4. orderItem.variant.product.imageUrl （購入時商品スナップショット）
  const baseUrl =
    delivery.digitalContent.baseImageUrl ??
    (delivery.digitalContent.baseImageKey
      ? `/api/admin/deliveries/base-image/${encodeURIComponent(delivery.digitalContent.baseImageKey)}`
      : null) ??
    delivery.digitalContent.product?.imageUrl ??
    delivery.orderItem.variant.product.imageUrl ??
    null;

  // 動画/画像の判定。productKind が DIGITAL_VIDEO_SIGN なら動画背景として扱う。
  const productKind =
    delivery.digitalContent.product?.productKind ??
    delivery.orderItem.variant.product.productKind ??
    "PHYSICAL";
  const mediaKind: "video" | "image" =
    productKind === "DIGITAL_VIDEO_SIGN" ? "video" : "image";

  // 商品編集ページへの導線（原本未登録時に表示）。
  const productId =
    delivery.digitalContent.productId ??
    delivery.digitalContent.product?.id ??
    delivery.orderItem.variant.product.id ??
    null;
  const productEditHref = productId ? `/admin/products/${productId}` : null;

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
      baseImageUrl={baseUrl}
      baseMediaKind={mediaKind}
      productEditHref={productEditHref}
      pendingCount={pendingCount}
      nextDeliveryId={next?.id ?? null}
    />
  );
}
