import { Providers } from "@/components/Providers";
import { UserFooter } from "@/components/user/UserFooter";
import { UserHeader } from "@/components/user/UserHeader";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex min-h-screen flex-col">
        <UserHeader />
        <main className="flex-1">{children}</main>
        <UserFooter />
      </div>
    </Providers>
  );
}
