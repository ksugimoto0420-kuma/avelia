import { notFound } from "next/navigation";
import { DigitalContentForm } from "@/components/admin/DigitalContentForm";
import { DeleteDigitalContentButton } from "@/components/admin/DeleteDigitalContentButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "デジタルコンテンツ編集 | 管理" };

export default async function EditDigitalContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const { id } = await params;

  const [content, products] = await Promise.all([
    prisma.digitalContent.findUnique({
      where: { id },
      include: {
        _count: { select: { userGrants: true, deliveries: true } },
      },
    }),
    prisma.product.findMany({
      where: { type: "DIGITAL" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!content) notFound();

  const canDelete =
    content._count.userGrants === 0 && content._count.deliveries === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        デジタルコンテンツ編集
      </h1>
      <DigitalContentForm
        products={products}
        initial={{
          id: content.id,
          productId: content.productId,
          title: content.title,
          description: content.description,
          // UI では IMAGE/FILE の 2 種だけサポート。旧データ (VIDEO/AUDIO) は
          // FILE に丸めて表示。再保存時に FILE として上書きされる。
          type: content.type === "IMAGE" ? "IMAGE" : "FILE",
          deliveryType: content.deliveryType,
          fileKey: content.fileKey,
          baseImageKey: content.baseImageKey,
          baseImageUrl: content.baseImageUrl,
          viewLimitDays: content.viewLimitDays,
          downloadLimit: content.downloadLimit,
        }}
      />

      <Card className="border-red-200">
        <CardHeader title="削除" />
        <CardBody className="space-y-3">
          {canDelete ? (
            <>
              <p className="text-sm text-gray-600">
                このコンテンツはまだ誰にも付与されていません。削除できます。
              </p>
              <DeleteDigitalContentButton id={content.id} title={content.title} />
            </>
          ) : (
            <p className="text-sm text-gray-600">
              既にユーザーへの付与（{content._count.userGrants}件）
              または納品（{content._count.deliveries}件）があるため削除できません。
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
