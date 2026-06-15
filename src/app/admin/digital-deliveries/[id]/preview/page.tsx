import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { SignedImagePreview } from "@/components/SignedImagePreview";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "サイン合成プレビュー" };

export default async function AdminDeliveryPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const { id } = await params;

  const delivery = await prisma.digitalDelivery.findUnique({
    where: { id },
    include: {
      digitalContent: { select: { title: true } },
      order: { select: { orderNumber: true } },
      user: { select: { email: true } },
      signature: { select: { status: true } },
    },
  });
  if (!delivery) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/admin/digital-deliveries"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← 納品一覧に戻る
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">
            {delivery.digitalContent.title}
          </h1>
          {delivery.signature?.status === "WRITTEN" && (
            <Badge color="yellow">承認待ち</Badge>
          )}
          {delivery.signature?.status === "COMPLETED" && (
            <Badge color="green">承認済み</Badge>
          )}
          {delivery.signature?.status === "REJECTED" && (
            <Badge color="red">却下</Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          注文 {delivery.order.orderNumber} ／ {delivery.user.email} ／ 宛名:{" "}
          <b className="text-gray-700">{delivery.nickname ?? "—"}</b>
        </p>
      </div>
      <SignedImagePreview
        deliveryId={delivery.id}
        showDownloadButton={true}
        countDownload={false}
      />
    </div>
  );
}
