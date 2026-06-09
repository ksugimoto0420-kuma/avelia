import { MypageNav } from "@/components/user/MypageNav";
import { requireUserPage } from "@/lib/auth/user-page";

export default async function MypageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUserPage();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">マイページ</h1>
      <div className="mt-6">
        <MypageNav />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
