import { notFound } from "next/navigation";
import { SignSession } from "@/app/admin/sign-session/[deliveryId]/SignSession";
import { requireTalentPage } from "@/lib/auth/talent-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "サイン記入 | Avelia for Talent" };

export default async function TalentSignPage({
  params,
}: {
  params: Promise<{ deliveryId: string }>;
}) {
  const me = await requireTalentPage();
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
          product: {
            select: {
              id: true,
              imageUrl: true,
              productKind: true,
              event: {
                select: { id: true, title: true, artistId: true },
              },
            },
          },
        },
      },
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
                  event: {
                    select: { id: true, title: true, artistId: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!delivery) notFound();

  // TALENT は自分の assignedArtistId に紐付くもののみ閲覧可
  const deliveryArtistId =
    delivery.digitalContent.product?.event.artistId ??
    delivery.orderItem.variant.product.event.artistId ??
    null;
  if (me.role === "TALENT") {
    if (
      !me.assignedArtistId ||
      me.assignedArtistId !== deliveryArtistId
    ) {
      notFound();
    }
  }

  if (delivery.status === "READY") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-gray-500">この納品は既に完了しています。</p>
      </div>
    );
  }

  // 次の未記入納品（同じイベント・同じアーティスト配下）
  const productEventId =
    delivery.digitalContent.product?.event.id ??
    delivery.orderItem.variant.product.event.id;
  const artistFilter =
    me.role === "TALENT" && me.assignedArtistId
      ? {
          digitalContent: {
            product: { event: { artistId: me.assignedArtistId } },
          },
        }
      : {};

  const next = await prisma.digitalDelivery.findFirst({
    where: {
      status: "PENDING",
      id: { not: deliveryId },
      OR: [{ signature: { is: null } }, { signature: { status: "REJECTED" } }],
      ...(productEventId
        ? { digitalContent: { product: { eventId: productEventId } } }
        : artistFilter),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const pendingCount = await prisma.digitalDelivery.count({
    where: {
      status: "PENDING",
      OR: [{ signature: { is: null } }, { signature: { status: "REJECTED" } }],
      ...(productEventId
        ? { digitalContent: { product: { eventId: productEventId } } }
        : artistFilter),
    },
  });

  const baseUrl =
    delivery.digitalContent.baseImageUrl ??
    (delivery.digitalContent.baseImageKey
      ? `/api/admin/deliveries/base-image/${encodeURIComponent(delivery.digitalContent.baseImageKey)}`
      : null) ??
    delivery.digitalContent.product?.imageUrl ??
    delivery.orderItem.variant.product.imageUrl ??
    null;

  // 動画/画像の判定。DIGITAL_VIDEO_SIGN の商品なら動画として表示。
  const productKind =
    delivery.digitalContent.product?.productKind ??
    delivery.orderItem.variant.product.productKind ??
    "PHYSICAL";
  const mediaKind: "video" | "image" =
    productKind === "DIGITAL_VIDEO_SIGN" ? "video" : "image";

  // タレント側では商品編集導線は表示しない（運営操作の範囲外）。
  const productEditHref: string | null = null;

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
      exitHref="/talent"
      nextHrefPrefix="/talent/sign/"
      doneHref="/talent/done"
      submitEndpoint="/api/talent/signatures"
    />
  );
}
