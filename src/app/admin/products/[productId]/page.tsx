import { notFound } from "next/navigation";
import { ProductForm, type ProductFormData } from "@/components/admin/ProductForm";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";

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
        variants: { include: { inventory: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);
  if (!product) notFound();

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
    </div>
  );
}
