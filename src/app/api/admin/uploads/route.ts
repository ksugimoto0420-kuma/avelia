import { AppError, handleError, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import {
  storage,
  StoragePaths,
  type StorageBucket,
} from "@/lib/storage";

export const runtime = "nodejs";

/**
 * 管理画面からの任意ファイルアップロード。
 *
 * FormData:
 *   file       : Blob 本体 (必須)
 *   bucket     : "private-digital" | "private-admin" (任意、既定は private-admin)
 *   purpose    : "delivery-base-image" | "content" | "generic" (任意、path prefix 決定用)
 *   contentId  : delivery-base-image / content 用のエンティティID (任意)
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin("OPERATOR");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("ファイルが指定されていません", 400);
    }

    const bucket = normalizeBucket(form.get("bucket"));
    const purpose = String(form.get("purpose") ?? "generic");
    const contentId = String(form.get("contentId") ?? "");
    const pathnamePrefix = resolvePathnamePrefix(purpose, contentId, admin.id);

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storage.put(buffer, file.name, {
      bucket,
      pathnamePrefix,
    });
    return ok(stored, 201);
  } catch (err) {
    return handleError(err);
  }
}

const ALLOWED_BUCKETS: readonly StorageBucket[] = [
  "private-digital",
  "private-admin",
] as const;

function normalizeBucket(raw: FormDataEntryValue | null): StorageBucket {
  const value = typeof raw === "string" ? raw : "";
  return (ALLOWED_BUCKETS as readonly string[]).includes(value)
    ? (value as StorageBucket)
    : "private-admin";
}

function resolvePathnamePrefix(
  purpose: string,
  contentId: string,
  adminId: string,
): string {
  switch (purpose) {
    case "delivery-base-image":
      if (contentId) return StoragePaths.deliveryBaseImage(contentId);
      break;
    case "content":
      if (contentId) return `contents/${contentId}`;
      break;
  }
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return StoragePaths.adminUpload(adminId, yyyymmdd);
}
