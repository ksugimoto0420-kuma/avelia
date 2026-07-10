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
 *   bucket     : "public-assets" | "private-digital" | "private-admin" (任意、既定 private-admin)
 *   purpose    : "delivery-base-image" | "content" | "product" | "event" | "generic" (path prefix 決定用)
 *   contentId  : delivery-base-image / content 用のエンティティID (任意)
 *   entityId   : product / event 用のエンティティID (任意)
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
    const entityId = String(form.get("entityId") ?? "");
    const pathnamePrefix = resolvePathnamePrefix({
      purpose,
      contentId,
      entityId,
      adminId: admin.id,
    });

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
  "public-assets",
  "private-digital",
  "private-admin",
] as const;

function normalizeBucket(raw: FormDataEntryValue | null): StorageBucket {
  const value = typeof raw === "string" ? raw : "";
  return (ALLOWED_BUCKETS as readonly string[]).includes(value)
    ? (value as StorageBucket)
    : "private-admin";
}

function resolvePathnamePrefix(args: {
  purpose: string;
  contentId: string;
  entityId: string;
  adminId: string;
}): string {
  switch (args.purpose) {
    case "delivery-base-image":
      if (args.contentId) return StoragePaths.deliveryBaseImage(args.contentId);
      break;
    case "content":
      if (args.contentId) return `contents/${args.contentId}`;
      break;
    case "product":
      // 新規作成時は entityId 未定なので new/{yyyymmdd} で受ける
      if (args.entityId) return StoragePaths.productThumbnail(args.entityId);
      return StoragePaths.productThumbnail("new");
    case "event":
      if (args.entityId) return StoragePaths.eventBanner(args.entityId);
      return StoragePaths.eventBanner("new");
  }
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return StoragePaths.adminUpload(args.adminId, yyyymmdd);
}
