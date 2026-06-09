import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * 管理者操作ログを記録する（仕様書 15. セキュリティ要件）。
 * 失敗してもメイン処理を止めないよう握りつぶす。
 */
export async function logOperation(params: {
  adminUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await prisma.operationLog.create({
      data: {
        adminUserId: params.adminUserId ?? null,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        detail: params.detail,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[OPERATION LOG] 記録失敗", err);
  }
}
