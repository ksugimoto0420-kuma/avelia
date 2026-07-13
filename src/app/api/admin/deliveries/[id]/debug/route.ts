import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * 管理者用: 特定の DigitalDelivery の baseImage 解決に使う実データを表示する
 * デバッグエンドポイント。原本画像が意図通り出ないときの切り分けに使う。
 * 本番でも触れる想定 (管理者のみ)。
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin("OPERATOR");
    const { id } = await params;
    const delivery = await prisma.digitalDelivery.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        digitalContentId: true,
        digitalContent: {
          select: {
            id: true,
            title: true,
            baseImageKey: true,
            baseImageBucket: true,
            baseImageUrl: true,
            productId: true,
            product: { select: { id: true, imageUrl: true } },
          },
        },
        orderItem: {
          select: {
            productName: true,
            variant: {
              select: {
                product: { select: { id: true, imageUrl: true } },
              },
            },
          },
        },
      },
    });
    if (!delivery) return new Response("Not found", { status: 404 });
    return Response.json({ data: delivery });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
