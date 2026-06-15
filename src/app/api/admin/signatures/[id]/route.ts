import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// 管理者向け：Signature の画像をPNGで返す。
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const sig = await prisma.signature.findUnique({ where: { id } });
    if (!sig?.imageData) {
      return new Response("Not Found", { status: 404 });
    }
    return new Response(new Uint8Array(sig.imageData), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
