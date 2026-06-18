import { ProductForm, type ProductFormData } from "@/components/admin/ProductForm";
import { Alert } from "@/components/ui/Alert";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const { eventId } = await searchParams;
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

  const initial: ProductFormData = {
    eventId: eventId ?? "",
    slug: "",
    name: "",
    description: "",
    type: "PHYSICAL",
    fulfillmentSource: "IN_HOUSE",
    basePrice: 0,
    imageUrl: "",
    benefit: "",
    deliveryDate: "",
    notes: "",
    nicknameNote: "",
    isPublished: false,
    saleStartAt: "",
    saleEndAt: "",
    maxPerOrder: "",
    maxPerUser: "",
    lotteryOnly: false,
    variants: [
      {
        name: "標準",
        sku: "",
        price: 0,
        quantity: 0,
        isDefault: true,
        requiresNickname: false,
      },
    ],
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">新規商品</h1>
      {events.length === 0 ? (
        <Alert tone="warning" title="先にイベントを作成してください">
          商品はイベントに紐づきます。
        </Alert>
      ) : (
        <ProductForm initial={initial} events={events} />
      )}
    </div>
  );
}
