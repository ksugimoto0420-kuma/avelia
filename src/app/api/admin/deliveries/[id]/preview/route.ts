import { requireAdmin } from "@/lib/auth/guards";

export const runtime = "nodejs";

/**
 * 管理者向け：合成済みプレビューページへリダイレクト（クライアント側合成方式）。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin("OPERATOR");
    const { id } = await params;
    const origin = new URL(req.url).origin;
    return Response.redirect(
      `${origin}/admin/digital-deliveries/${id}/preview`,
      302,
    );
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
