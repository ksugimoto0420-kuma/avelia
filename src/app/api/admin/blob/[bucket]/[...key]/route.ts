import path from "node:path";
import { requireAdmin } from "@/lib/auth/guards";
import { contentTypeFor } from "@/lib/mime";
import {
  storage,
  StorageNotFoundError,
  isPrivateBucket,
  type StorageBucket,
} from "@/lib/storage";

export const runtime = "nodejs";

const ALLOWED_BUCKETS: readonly StorageBucket[] = [
  "public-assets",
  "private-digital",
  "private-admin",
  "private-temp",
] as const;

/**
 * 管理者向けの汎用 blob 参照エンドポイント。
 *
 * GET /api/admin/blob/{bucket}/{...key}
 *
 * 管理画面のプレビュー表示 (ImageUploadField 等) から使う。
 * OPERATOR 以上でログインしていれば bucket の中身を認可付きで配信する。
 * 購入者向け配信 (/api/user/digital-contents/file) とは別ルート。
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bucket: string; key: string[] }> },
) {
  try {
    await requireAdmin("OPERATOR");
    const { bucket: rawBucket, key: keyParts } = await params;
    if (!(ALLOWED_BUCKETS as readonly string[]).includes(rawBucket)) {
      return new Response("Invalid bucket", { status: 400 });
    }
    const bucket = rawBucket as StorageBucket;

    if (!keyParts || keyParts.length === 0) {
      return new Response("Key required", { status: 400 });
    }
    // Next の catch-all は既に decode 済みだが、"/" を含む pathname を復元する
    const key = keyParts.map((s) => decodeURIComponent(s)).join("/");

    // public バケットは Vercel Blob の直URLを使う想定なので、
    // このルートは private 系のみを対象とする。
    if (!isPrivateBucket(bucket)) {
      return new Response(
        "public-assets はこのルート経由で参照しないでください (直URLを使ってください)",
        { status: 400 },
      );
    }

    try {
      const { buffer } = await storage.getFile(bucket, key);
      const basename = path.basename(key);
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": contentTypeFor(basename),
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(basename)}`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch (e) {
      if (e instanceof StorageNotFoundError) {
        return new Response("Not found", { status: 404 });
      }
      throw e;
    }
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
