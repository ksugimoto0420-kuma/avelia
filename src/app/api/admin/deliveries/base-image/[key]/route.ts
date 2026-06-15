import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/auth/guards";
import { localFilePath } from "@/lib/storage";
import { contentTypeFor } from "@/lib/mime";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * サイン用ベース画像（原本）の管理者向け配信。
 * 1. ローカル /storage/<key> にファイルがあればそれを返す
 * 2. 無ければ、同じ key を持つ DigitalContent.baseImageUrl をfetchして返す
 *    （MVPでは外部URLを原本として扱える）
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    await requireAdmin("OPERATOR");
    const { key: rawKey } = await params;
    const key = decodeURIComponent(rawKey);

    // 1. ローカルストレージから読む
    try {
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
      // 続けて外部URLを試す
    }

    // 2. baseImageKey に紐づく DigitalContent.baseImageUrl があればそれを使う
    const dc = await prisma.digitalContent.findFirst({
      where: { baseImageKey: key, baseImageUrl: { not: null } },
      select: { baseImageUrl: true },
    });
    if (dc?.baseImageUrl) {
      const res = await fetch(dc.baseImageUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const ct = res.headers.get("content-type") ?? "image/jpeg";
        return new Response(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": ct,
            "Content-Disposition": `attachment; filename="original_${path.basename(key)}.jpg"`,
            "Cache-Control": "private, no-store",
          },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
