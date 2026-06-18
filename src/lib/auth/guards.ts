import type { AdminRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * ログイン中の一般ユーザーを要求する。未ログイン時は AuthError(401)。
 * セッションは有効でも DB にユーザーが存在しない（削除済み・再シード等）場合も
 * 401 として扱い、再ログインへ誘導する（外部キー違反による500を防ぐ）。
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user || session.user.kind !== "user") {
    throw new AuthError("ログインが必要です", 401);
  }
  const exists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!exists) {
    throw new AuthError("セッションが無効です。再度ログインしてください", 401);
  }
  return session.user;
}

/** ログイン中の一般ユーザーを返す（未ログインなら null）。 */
export async function getOptionalUser() {
  const session = await auth();
  if (!session?.user || session.user.kind !== "user") return null;
  return session.user;
}

// ロールの権限強度（数値が大きいほど強い）。
// TALENT はタレント本人専用で、管理画面（VIEWER 以上）には入れない。
const ROLE_RANK: Record<AdminRole, number> = {
  TALENT: 0,
  VIEWER: 1,
  OPERATOR: 2,
  MANAGER: 3,
  OWNER: 4,
};

/**
 * 管理者を要求する。minRole 未満の場合は AuthError(403)。
 * 例: requireAdmin("MANAGER")
 */
export async function requireAdmin(minRole: AdminRole = "VIEWER") {
  const session = await auth();
  if (!session?.user || session.user.kind !== "admin") {
    throw new AuthError("管理者ログインが必要です", 401);
  }
  const role = session.user.role;
  if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new AuthError("この操作を行う権限がありません", 403);
  }
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.user.id },
    select: { id: true, isActive: true },
  });
  if (!admin || !admin.isActive) {
    throw new AuthError("セッションが無効です。再度ログインしてください", 401);
  }
  return session.user;
}

export function hasRole(role: AdminRole | null | undefined, minRole: AdminRole) {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}
