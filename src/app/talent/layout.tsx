import { auth } from "@/auth";
import { Providers } from "@/components/Providers";
import { TalentHeader } from "@/components/talent/TalentHeader";
import { TalentLayoutShell } from "@/components/talent/TalentLayoutShell";

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
      {/*
        #100: サイン記入画面 (/talent/sign/*) はタブレット横向きで
        画面全体を使うため、TalentLayoutShell で pathname を見て
        ヘッダーの有無・スクロール抑止を切り替える。
      */}
      <TalentLayoutShell
        header={
          <TalentHeader
            name={session.user.name ?? session.user.email ?? "ゲスト"}
            role={session.user.role ?? "TALENT"}
          />
        }
      >
        {children}
      </TalentLayoutShell>
    </Providers>
  );
}
