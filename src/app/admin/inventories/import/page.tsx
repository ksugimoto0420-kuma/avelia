import { requireAdminPage } from "@/lib/auth/admin-page";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "在庫CSV取込" };

export default async function InventoryImportPage() {
  await requireAdminPage("OPERATOR");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">在庫CSV取込</h1>
      <ImportForm />
    </div>
  );
}
