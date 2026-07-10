import path from "node:path";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  storage,
  StorageNotFoundError,
  type StorageBucket,
} from "@/lib/storage";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
};

/**
 * 認可済みデジタルコンテンツ配信。
 * ログインユーザーが当該コンテンツの閲覧権限を持つ場合のみ配信する（仕様書 8/15）。
 * 本番では署名付きURLにリダイレクトする想定。
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const user = await requireUser();
    const { key: rawKey } = await params;
    const key = decodeURIComponent(rawKey);

    const content = await prisma.digitalContent.findFirst({
      where: { fileKey: key },
      select: {
        id: true,
        publishAt: true,
        downloadLimit: true,
        storageBucket: true,
        baseImageKey: true,
        baseImageBucket: true,
      },
    });
    if (!content) return new Response("Not found", { status: 404 });

    const grant = await prisma.userDigitalContent.findUnique({
      where: {
        userId_digitalContentId: {
          userId: user.id,
          digitalContentId: content.id,
        },
      },
    });
    if (!grant) return new Response("Forbidden", { status: 403 });

    const now = new Date();
    if (content.publishAt && content.publishAt > now) {
      return new Response("まだ公開されていません", { status: 403 });
    }
    if (grant.expiresAt && grant.expiresAt < now) {
      return new Response("閲覧期限が切れています", { status: 403 });
    }
    if (
      content.downloadLimit != null &&
      grant.downloadCount >= content.downloadLimit
    ) {
      return new Response("ダウンロード回数の上限に達しています", {
        status: 403,
      });
    }

    // fileKey は content.storageBucket、baseImageKey は content.baseImageBucket を
    // それぞれ参照する。ここでは fileKey ヒット時の bucket を使う。
    let buffer: Buffer;
    try {
      ({ buffer } = await storage.getFile(
        content.storageBucket as StorageBucket,
        key,
      ));
    } catch (e) {
      if (e instanceof StorageNotFoundError) {
        return new Response("Not found", { status: 404 });
      }
      throw e;
    }
    await prisma.userDigitalContent.update({
      where: { id: grant.id },
      data: { downloadCount: { increment: 1 }, viewCount: { increment: 1 } },
    });

    const ext = path.extname(key).toLowerCase();
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
