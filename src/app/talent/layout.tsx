import { auth } from "@/auth";
import { Providers } from "@/components/Providers";
import { TalentHeader } from "@/components/talent/TalentHeader";

export const metadata = {
  title: "Avelia for Talent",
  description: "タレント向け サイン記入ページ",
};

export default async function TalentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAdminSession = session?.user?.kind === "admin";

  // 未認証（ログインページ等）はクロームなしで表示
  if (!isAdminSession) {
    return <Providers>{children}</Providers>;
  }

  return (
    <Providers>
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-brand-50 to-white">
        <TalentHeader
          name={session.user.name ?? session.user.email ?? "ゲスト"}
          role={session.user.role ?? "TALENT"}
        />
        <main className="flex-1">{children}</main>
      </div>
    </Providers>
  );
}
