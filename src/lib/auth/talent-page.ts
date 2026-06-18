import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * /talent 配下用ガード。未認証なら /talent/login へリダイレクト。
 * 認証済み AdminUser のうち、role=TALENT もしくは上位（OPERATOR以上の管理者で
 * テストする場合に備える）が許可される。
 * 自身に紐付くアーティスト ID を併せて返す。TALENT で未割当の場合は専用画面へ。
 */
export async function requireTalentPage() {
  const session = await auth();
  if (!session?.user || session.user.kind !== "admin") {
    redirect("/talent/login");
  }
  // タレント本人 or 管理者（テスト用）のみ通す
  const role = session.user.role;
  if (role !== "TALENT" && role !== "OWNER" && role !== "MANAGER") {
    redirect("/talent/login");
  }
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
      assignedArtistId: true,
      assignedArtist: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!admin || !admin.isActive) {
    redirect("/talent/login");
  }
  return admin;
}
