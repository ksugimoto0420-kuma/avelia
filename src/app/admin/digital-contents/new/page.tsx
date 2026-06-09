import { DigitalContentForm } from "@/components/admin/DigitalContentForm";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewDigitalContentPage() {
  await requireAdminPage("OPERATOR");
  const products = await prisma.product.findMany({
    where: { type: "DIGITAL" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        デジタルコンテンツ登録
      </h1>
      <DigitalContentForm products={products} />
    </div>
  );
}
