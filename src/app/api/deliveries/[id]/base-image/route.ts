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
        // 続けて 2. の外部URLへフォールバック
      }
    }

    // 2. baseImageUrl (公開URL) をプロキシ配信する
    // - 直接 <img src> に外部URLを返してしまうと、Canvas 描画が CORS で
    //   汚染される可能性があるため、自ドメインからバイナリで返して同一
    //   オリジンにしておくと SignedImagePreview 側のロジックが安定する。
    const externalUrl =
      delivery.digitalContent.baseImageUrl ??
      delivery.orderItem.variant.product.imageUrl ??
      null;
    if (externalUrl) {
      const res = await fetch(externalUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const ct = res.headers.get("content-type") ?? contentTypeFor(externalUrl);
        return new Response(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": ct,
            "Cache-Control": "private, no-store",
          },
        });
      }
    }

    return new Response("原本画像が設定されていません", { status: 404 });
  } catch (err) {
    console.error("[api/deliveries/base-image] エラー", err);
    return new Response("エラーが発生しました", { status: 500 });
  }
}
