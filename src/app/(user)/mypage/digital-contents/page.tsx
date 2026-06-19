import {
  DigitalContentCard,
  type DigitalContentCardData,
} from "@/components/user/DigitalContentCard";
import { requireUserPage } from "@/lib/auth/user-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MypageDigitalContents() {
  const user = await requireUserPage("/mypage/digital-contents");
  const now = new Date();

  const [grants, deliveries] = await Promise.all([
    // 共通配信（SHARED）
    prisma.userDigitalContent.findMany({
      where: { userId: user.id },
      orderBy: { grantedAt: "desc" },
      include: {
        digitalContent: {
          include: {
            product: {
              select: {
                imageUrl: true,
                event: { select: { coverImageUrl: true } },
              },
            },
          },
        },
      },
    }),
    // 個別サイン納品（PERSONALIZED）
    prisma.digitalDelivery.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        digitalContent: {
          include: {
            product: {
              select: {
                imageUrl: true,
                event: { select: { coverImageUrl: true } },
              },
            },
          },
        },
        orderItem: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    imageUrl: true,
                    event: { select: { coverImageUrl: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  if (grants.length === 0 && deliveries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
        購入済みのデジタルコンテンツはありません
      </p>
    );
  }

  /**
   * カバー画像の優先順位（最初に見つかったものを採用）:
   *  1. DigitalContent 紐づけ商品の imageUrl
   *  2. 同イベントの coverImageUrl
   *  3. orderItem 経由（実際に購入された商品）の imageUrl
   *  4. 同イベントの coverImageUrl
   */
  function pickCover(...candidates: (string | null | undefined)[]): string | null {
    for (const c of candidates) if (c) return c;
    return null;
  }

  const grantCards: DigitalContentCardData[] = grants.map((g) => ({
    key: `grant-${g.id}`,
    title: g.digitalContent.title,
    type: g.digitalContent.type,
    expiresAt: g.expiresAt,
    expired: Boolean(g.expiresAt && g.expiresAt < now),
    href: `/mypage/digital-contents/${g.digitalContentId}`,
    coverImageUrl: pickCover(
      g.digitalContent.product?.imageUrl,
      g.digitalContent.product?.event?.coverImageUrl,
    ),
  }));

  const deliveryCards: DigitalContentCardData[] = deliveries.map((d) => {
    const expired = Boolean(d.expiresAt && d.expiresAt < now);
    const ready = d.status === "READY" && !expired;
    return {
      key: `delivery-${d.id}`,
      title: d.digitalContent.title,
      type: d.digitalContent.type,
      expiresAt: d.expiresAt,
      expired,
      signed: true,
      pending: d.status === "PENDING",
      nickname: d.nickname,
      href: ready ? `/api/user/deliveries/${d.id}` : null,
      isDownload: ready,
      coverImageUrl: pickCover(
        d.digitalContent.product?.imageUrl,
        d.digitalContent.product?.event?.coverImageUrl,
        d.orderItem.variant.product.imageUrl,
        d.orderItem.variant.product.event.coverImageUrl,
      ),
    };
  });

  // 個別納品（準備中→先頭）を上に、共通を下に
  const cards = [...deliveryCards, ...grantCards];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <DigitalContentCard key={c.key} data={c} />
      ))}
    </div>
  );
}
