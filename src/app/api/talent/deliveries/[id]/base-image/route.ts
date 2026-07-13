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
 * タレント向けサイン用ベース画像 (原本) 配信 (#100)。
 *
 * `/api/admin/deliveries/base-image/[key]` は OPERATOR 以上、
 * `/api/deliveries/[id]/base-image` は購入者本人向け。
 * TALENT ロールはどちらの認可も通らないため専用ルートを新設する。
 *
 * 認可:
 * - ログイン必須 (kind=admin)
 * - TALENT は自身の assignedArtistId に紐付く delivery のみ
 * - OWNER / MANAGER は制限なし (プレビュー・代理サイン用)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user || session.user.kind !== "admin") {
      return new Response("Unauthorized", { status: 401 });
    }
    const role = session.user.role;
    if (role !== "TALENT" && role !== "OWNER" && role !== "MANAGER") {
      return new Response("Forbidden", { status: 403 });
    }

    const delivery = await prisma.digitalDelivery.findUnique({
      where: { id },
      select: {
        digitalContent: {
          select: {
            baseImageKey: true,
            baseImageBucket: true,
            baseImageUrl: true,
            product: {
              select: {
                imageUrl: true,
                event: { select: { artistId: true } },
              },
            },
          },
        },
        orderItem: {
          select: {
            variant: {
              select: {
                product: {
                  select: {
                    imageUrl: true,
                    event: { select: { artistId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!delivery) return new Response("Not found", { status: 404 });

    if (role === "TALENT") {
      const me = await prisma.adminUser.findUnique({
        where: { id: session.user.id },
        select: { assignedArtistId: true, isActive: true },
      });
      if (!me || !me.isActive) {
        return new Response("Unauthorized", { status: 401 });
      }
      const deliveryArtistId =
        delivery.digitalContent.product?.event.artistId ??
        delivery.orderItem.variant.product.event.artistId ??
        null;
      if (
        !me.assignedArtistId ||
        me.assignedArtistId !== deliveryArtistId
      ) {
        return new Response("Not found", { status: 404 });
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
          `[talent-base-image] storage miss bucket=${delivery.digitalContent.baseImageBucket} key=${key} → fallback`,
        );
      }
    }

    // 2. baseImageUrl / 商品画像を順に試す
    const candidates: string[] = [
      delivery.digitalContent.baseImageUrl,
      delivery.digitalContent.product?.imageUrl,
      delivery.orderItem.variant.product.imageUrl,
    ].filter((u): u is string => !!u);

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
        } catch {
          // 継続
        }
      }
    }

    return new Response("原本画像が設定されていません", { status: 404 });
  } catch (err) {
    console.error("[api/talent/deliveries/base-image] エラー", err);
    return new Response("エラーが発生しました", { status: 500 });
  }
}

function parseAdminBlobUrl(
  url: string,
): { bucket: StorageBucket; key: string } | null {
  const m = url.match(/^\/api\/admin\/blob\/([^/]+)\/(.+)$/);
  if (!m) return null;
  const bucket = decodeURIComponent(m[1]) as StorageBucket;
  const key = m[2]
    .split("/")
    .map((s) => decodeURIComponent(s))
    .join("/");
  return { bucket, key };
}
