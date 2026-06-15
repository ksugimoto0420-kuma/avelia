import Link from "next/link";
import { notFound } from "next/navigation";
import { SignedImagePreview } from "@/components/SignedImagePreview";
import { requireUserPage } from "@/lib/auth/user-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "サイン入りデジタル写真集" };

export default async function SignedDigitalContentPage({
  params,
}: {
  params: Promise<{ deliveryId: string }>;
}) {
  const user = await requireUserPage();
  const { deliveryId } = await params;

  const delivery = await prisma.digitalDelivery.findFirst({
    where: { id: deliveryId, userId: user.id, status: "READY" },
    include: {
      digitalContent: { select: { title: true } },
      order: { select: { orderNumber: true } },
    },
  });
  if (!delivery) notFound();

  return (
    <div className="space-y-5">
      <Link
        href="/mypage/digital-contents"
        className="text-sm text-gray-500 hover:text-brand-600"
      >
        ← デジタルコンテンツ一覧に戻る
      </Link>
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {delivery.digitalContent.title}
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          注文 {delivery.order.orderNumber}
        </p>
      </div>
      <SignedImagePreview deliveryId={delivery.id} />
    </div>
  );
}
