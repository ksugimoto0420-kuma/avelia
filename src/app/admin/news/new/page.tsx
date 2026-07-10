import { NewsPostForm } from "@/components/admin/NewsPostForm";
import { requireAdminPage } from "@/lib/auth/admin-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEWS新規作成 | 管理" };

export default async function NewNewsPostPage() {
  await requireAdminPage("OPERATOR");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">NEWS 新規作成</h1>
      <NewsPostForm />
    </div>
  );
}
