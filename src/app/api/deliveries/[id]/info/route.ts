import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * クライアント側合成用：原本URL + サインPNG(base64) + メタを返す JSON API。
 * - 一般ユーザー → 自分が購入した READY 納品のみ
 * - 管理者(OPERATOR以上) → すべての納品（プレビュー目的）
 *   ※管理者は WRITTEN（サイン記入済み・未承認）の合成プレビューも見たい
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
      include: {
        digitalContent: {
          select: {
            title: true,
            downloadLimit: true,
            baseImageKey: true,
            baseImageUrl: true,
          },
        },
        order: { select: { orderNumber: true } },
        signature: { select: { id: true, imageData: true, status: true } },
        orderItem: {
          select: {
            variant: { select: { product: { select: { imageUrl: true } } } },
          },
        },
      },
    });
    if (!delivery) {
      return new Response("Not found", { status: 404 });
    }

    // 認可：管理者は全件、一般ユーザーは自分のもの＆READY のみ
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

    if (!delivery.signature?.imageData) {
      return new Response("サイン画像が見つかりません", { status: 404 });
    }

    // 原本画像のURLを解決する。
    // 一般ユーザーは購入者向けエンドポイント経由で返す (自ドメイン=CORS 汚染回避、
    // 認可も同エンドポイント内でチェック済み)。管理者は admin 用エンドポイントを
    // 引き続き使い、旧仕様の外部URL/商品画像フォールバックも維持する。
    const hasAnyBaseSource =
      !!delivery.digitalContent.baseImageKey ||
      !!delivery.digitalContent.baseImageUrl ||
      !!delivery.orderItem.variant.product.imageUrl;
    if (!hasAnyBaseSource) {
      return new Response("原本画像が設定されていません", { status: 404 });
    }
    const baseUrl = isAdmin
      ? (delivery.digitalContent.baseImageUrl ??
          (delivery.digitalContent.baseImageKey
            ? `/api/admin/deliveries/base-image/${encodeURIComponent(delivery.digitalContent.baseImageKey)}`
            : null) ??
          delivery.orderItem.variant.product.imageUrl ??
          "")
      : `/api/deliveries/${delivery.id}/base-image`;

    // サインPNGを base64 で返す（数十KB目安）
    const sigBuf = Buffer.isBuffer(delivery.signature.imageData)
      ? delivery.signature.imageData
      : Buffer.from(delivery.signature.imageData as Uint8Array);
    const signaturePngBase64 = sigBuf.toString("base64");

    const downloadFilename = `${delivery.nickname ?? "signed"}_${delivery.order.orderNumber}.png`;

    return Response.json({
      data: {
        deliveryId: delivery.id,
        title: delivery.digitalContent.title,
        nickname: delivery.nickname,
        baseImageUrl: baseUrl,
        signaturePngBase64,
        downloadFilename,
        signatureStatus: delivery.signature.status,
        deliveryStatus: delivery.status,
      },
    });
  } catch (err) {
    console.error("[api/deliveries/info] エラー", err);
    return new Response("エラーが発生しました", { status: 500 });
  }
}

/**
 * ダウンロードカウントを記録するだけの POST。
 * クライアントで合成→保存した直後に呼ぶ。
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (session.user.kind === "user") {
      // 自分のものだけカウント増
      const owned = await prisma.digitalDelivery.findFirst({
        where: { id, userId: session.user.id, status: "READY" },
        select: { id: true },
      });
      if (!owned) return new Response("Not found", { status: 404 });
      await prisma.digitalDelivery.update({
        where: { id },
        data: { downloadCount: { increment: 1 } },
      });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("[api/deliveries/info] count POST エラー", err);
    return new Response("エラー", { status: 500 });
  }
}
