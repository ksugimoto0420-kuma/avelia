import { notFound } from "next/navigation";
import { ProductForm, type ProductFormData } from "@/components/admin/ProductForm";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { deleteProduct } from "../actions";

export const dynamic = "force-dynamic";

function dtLocal(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const { productId } = await params;

  const [product, events] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          include: {
            inventory: true,
            _count: { select: { orderItems: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);
  if (!product) notFound();

  const orderCount = product.variants.reduce(
    (sum, v) => sum + v._count.orderItems,
    0,
  );
  const canDelete = orderCount === 0;

  const initial: ProductFormData = {
    id: product.id,
    eventId: product.eventId,
    slug: product.slug,
    name: product.name,
    description: product.description ?? "",
    type: product.type,
    basePrice: product.basePrice,
    imageUrl: product.imageUrl ?? "",
    benefit: product.benefit ?? "",
    deliveryDate: dtLocal(product.deliveryDate),
    notes: product.notes ?? "",
    nicknameNote: product.nicknameNote ?? "",
    isPublished: product.isPublished,
    saleStartAt: dtLocal(product.saleStartAt),
    saleEndAt: dtLocal(product.saleEndAt),
    maxPerOrder: product.maxPerOrder?.toString() ?? "",
    maxPerUser: product.maxPerUser?.toString() ?? "",
    lotteryOnly: product.lotteryOnly,
    variants: product.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: v.price,
      quantity: v.inventory?.quantity ?? 0,
      isDefault: v.isDefault,
      requiresNickname: v.requiresNickname,
    })),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">商品編集</h1>
      <ProductForm initial={initial} events={events} />

      <Card className="border-red-200">
        <CardHeader title="削除" />
        <CardBody className="space-y-3">
          {canDelete ? (
            <>
              <p className="text-sm text-gray-600">
                この商品にはまだ注文がありません。削除すると、関連するバリアント・在庫情報も含めて完全に削除されます。
              </p>
              <form action={deleteProduct}>
                <input type="hidden" name="id" value={product.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  この商品を削除する
                </button>
              </form>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              この商品には {orderCount} 件の注文があるため削除できません。販売を終了する場合は「非公開」に切り替えてください。
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
