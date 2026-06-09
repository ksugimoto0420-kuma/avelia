import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/auth/guards";
import { localFilePath } from "@/lib/storage";
import { contentTypeFor } from "@/lib/mime";

export const runtime = "nodejs";

/**
 * サイン用ベース画像（原本）の管理者向け配信。
 * タレントが原本をDLしてサイン→同じ納品行にアップロードする運用に用いる。
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    await requireAdmin("OPERATOR");
    const { key: rawKey } = await params;
    const key = decodeURIComponent(rawKey);
    const buffer = await readFile(localFilePath(key));
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(key),
        "Content-Disposition": `attachment; filename="${path.basename(key)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Unauthorized or not found", { status: 401 });
  }
}
