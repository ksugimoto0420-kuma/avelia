import { auth } from "@/auth";
import { Providers } from "@/components/Providers";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "オーナー",
  MANAGER: "マネージャー",
  OPERATOR: "オペレーター",
  VIEWER: "閲覧者",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAdmin = session?.user?.kind === "admin";

  // 未認証（ログインページ等）はクロームなしで表示
  if (!isAdmin) {
    return <Providers>{children}</Providers>;
  }

  return (
    <Providers>
      <div className="flex min-h-screen bg-gray-50">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader
            name={session.user.name ?? session.user.email}
            role={ROLE_LABEL[session.user.role ?? "VIEWER"] ?? ""}
          />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
