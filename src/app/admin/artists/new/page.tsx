import { ArtistForm } from "@/components/admin/ArtistForm";
import { requireAdminPage } from "@/lib/auth/admin-page";

export const dynamic = "force-dynamic";

export const metadata = { title: "新規アーティスト" };

export default async function NewArtistPage() {
  await requireAdminPage("OPERATOR");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">新規アーティスト</h1>
      <ArtistForm />
    </div>
  );
}
