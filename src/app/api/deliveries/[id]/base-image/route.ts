import { auth } from "@/auth";
import { contentTypeFor } from "@/lib/mime";
import { prisma } from "@/lib/prisma";
import {
  storage,
  StorageNotFoundError,
  type StorageBucket,
} from "@/lib/storage";

export const runtime = "nodejs";

/**
 * 購入者向けのサイン用ベース画像 (原本) 配信。
 *
 * `/api/admin/deliveries/base-image/[key]` は管理者専用なので、
 * 購入者が SignedImagePreview から原本を読み込むにはこちらを使う。
 *
 * 認可:
 * - ログイン必須
 * - 一般ユーザーは自分の READY 納品のみ・期限内・DL上限内
 * - 管理者(OPERATOR以上) は制限なし (プレビュー目的)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }
    const isAdmin = session.user.kind === "admin";
    const isUser = session.user.kind === "user";

    const delivery = await prisma.digitalDelivery.findUnique({
      where: { id },
      select: {
        userId: true,
        status: true,
        expiresAt: true,
        downloadCount: true,
        digitalContent: {
          select: {
            baseImageKey: true,
            baseImageBucket: true,
            baseImageUrl: true,
            downloadLimit: true,
            product: { select: { imageUrl: true } },
          },
        },
        orderItem: {
          select: {
            variant: { select: { product: { select: { imageUrl: true } } } },
          },
        },
      },
    });
    if (!delivery) return new Response("Not found", { status: 404 });

    if (!isAdmin) {
      if (!isUser || delivery.userId !== session.user.id) {
        return new Response("Not found", { status: 404 });
      }
      if (delivery.status !== "READY") {
        return new Response("準備中です", { status: 403 });
      }
      const now = new Date();
      if (delivery.expiresAt && delivery.expiresAt < now) {
        return new Response("閲覧期限が切れています", { status: 403 });
      }
      const limit = delivery.digitalContent.downloadLimit;
      if (limit != null && delivery.downloadCount >= limit) {
        return new Response("ダウンロード回数の上限に達しています", {
          status: 403,
        });
      }
    }

    // 1. プライベートバケットに key があればそこから返す
    const key = delivery.digitalContent.baseImageKey;
    if (key) {
      try {
        const { buffer } = await storage.getFile(
          delivery.digitalContent.baseImageBucket as StorageBucket,
          key,
        );
        return new Response(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": contentTypeFor(key),
            "Cache-Control": "private, no-store",
          },
        });
      } catch (e) {
        if (!(e instanceof StorageNotFoundError)) throw e;
        console.warn(
          `[base-image] storage miss bucket=${delivery.digitalContent.baseImageBucket} key=${key} → fallback`,
        );
        // 続けて 2. の外部URLへフォールバック
      }
    }

    // 2. baseImageUrl / 商品画像を順に試す。1件でも読めたらそれを返す。
    // baseImageUrl が /api/admin/blob/... のような認可保護URLならパスから
    // bucket+key を復元して storage 経由で直接読む (サーバー間 fetch では
    // クッキーが乗らず 401 になるため)。
    const candidates: string[] = [
      delivery.digitalContent.baseImageUrl,
      delivery.digitalContent.product?.imageUrl,
      delivery.orderItem.variant.product.imageUrl,
    ].filter((u): u is string => !!u);

    const attempted: Array<{ url: string; via: string; result: string }> = [];
    for (const url of candidates) {
      const adminBlob = parseAdminBlobUrl(url);
      if (adminBlob) {
        try {
          const { buffer } = await storage.getFile(
            adminBlob.bucket,
            adminBlob.key,
          );
          return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
              "Content-Type": contentTypeFor(adminBlob.key),
              "Cache-Control": "private, no-store",
            },
          });
        } catch (e) {
          if (!(e instanceof StorageNotFoundError)) throw e;
          attempted.push({
            url,
            via: `storage:${adminBlob.bucket}/${adminBlob.key}`,
            result: "not-found",
          });
          continue;
        }
      }
      if (/^https?:\/\//i.test(url)) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            const ct = res.headers.get("content-type") ?? contentTypeFor(url);
            return new Response(new Uint8Array(buffer), {
              status: 200,
              headers: {
                "Content-Type": ct,
                "Cache-Control": "private, no-store",
              },
            });
          }
          attempted.push({ url, via: "fetch", result: `http-${res.status}` });
        } catch (e) {
          attempted.push({
            url,
            via: "fetch",
            result: `err:${e instanceof Error ? e.message : String(e)}`,
          });
        }
        continue;
      }
      attempted.push({ url, via: "unknown-scheme", result: "skip" });
    }

    // ここまで到達 = 全ソースが空 or どれも到達不能。診断情報を返す。
    const diag = {
      hasBaseImageKey: !!delivery.digitalContent.baseImageKey,
      hasBaseImageUrl: !!delivery.digitalContent.baseImageUrl,
      hasDcProductImage: !!delivery.digitalContent.product?.imageUrl,
      hasVariantProductImage:
        !!delivery.orderItem.variant.product.imageUrl,
      attempted,
    };
    console.warn("[base-image] all sources unreachable", {
      deliveryId: id,
      diag,
    });
    return new Response(
      `原本画像が設定されていません: ${JSON.stringify(diag)}`,
      { status: 404 },
    );
  } catch (err) {
    console.error("[api/deliveries/base-image] エラー", err);
    return new Response("エラーが発生しました", { status: 500 });
  }
}

/**
 * `/api/admin/blob/<bucket>/<...key>` を再解析して bucket + key を復元する。
 * VercelBlobDriver.buildAdminBlobUrl が生成する URL 形式に対応する。
 */
function parseAdminBlobUrl(
  url: string,
): { bucket: StorageBucket; key: string } | null {
  const m = url.match(/^\/api\/admin\/blob\/([^/]+)\/(.+)$/);
  if (!m) return null;
  const bucket = decodeURIComponent(m[1]) as StorageBucket;
  const segments = m[2].split("/").map((s) => decodeURIComponent(s));
  // 保存時は bucket プレフィックスを除いた形で URL 化されているため戻す
  const key = `${bucket}/${segments.join("/")}`;
  return { bucket, key };
}
