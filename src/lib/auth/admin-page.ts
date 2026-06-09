import type { AdminRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/guards";

/**
 * 管理ページ用ガード。未認証なら /admin/login へ、権限不足なら /admin/dashboard へ。
 * Server Component から呼ぶ。
 */
export async function requireAdminPage(minRole: AdminRole = "VIEWER") {
  const session = await auth();
  if (!session?.user || session.user.kind !== "admin") {
    redirect("/admin/login");
  }
  if (!hasRole(session.user.role, minRole)) {
    redirect("/admin/dashboard");
  }
  return session.user;
}
