import { auth } from "@/auth";
import { buildInvoicePropsForOrder } from "@/lib/pdf/buildInvoiceProps";
import { renderInvoiceBuffer } from "@/lib/pdf/renderInvoice";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
// @react-pdf の初回起動でフォント fetch が入るため、Hobby の10秒より
// 少し長めのタイムアウトを想定する。Vercel Pro 60秒圏内であれば十分。
export const maxDuration = 60;

/**
 * 購入者向け: 納品書 PDF ダウンロード。
 *
 * - 認証必須
 * - 自分の注文のみ
 * - status が PAID / SHIPPED / DELIVERED / CANCELLED (すでに支払い済みで有効) のみ
 *   PENDING は DL 不可
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const session = await auth();
  if (!session?.user || session.user.kind !== "user") {
    return new Response("Unauthorized", { status: 401 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: session.user.id },
    select: { id: true, status: true, orderNumber: true },
  });
  if (!order) return new Response("Not found", { status: 404 });
  if (order.status === "PENDING") {
    return new Response("お支払い前のご注文は発行できません", { status: 403 });
  }

  const props = await buildInvoicePropsForOrder(order.id);
  if (!props) return new Response("Not found", { status: 404 });

  const pdf = await renderInvoiceBuffer(props);

  const filename = `納品書_${order.orderNumber}.pdf`;
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
