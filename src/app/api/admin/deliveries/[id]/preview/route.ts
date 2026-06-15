import { requireAdmin } from "@/lib/auth/guards";
import { generateSignedImage } from "@/lib/signed-image";

export const runtime = "nodejs";

/**
 * 管理者向け：サイン入り合成済みPNGを返す（プレビュー用）。
 * 保存はせず、毎回サーバーで sharp.composite() を実行して返す。
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin("OPERATOR");
    const { id } = await params;
    const buffer = await generateSignedImage(id);
    if (!buffer) {
      return new Response("生成できませんでした（原本かサインが不足）", {
        status: 404,
      });
    }
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      (err as { status?: number }).status === 401
    ) {
      return new Response("Unauthorized", { status: 401 });
    }
    console.error("[admin/deliveries/preview] プレビュー生成エラー", err);
    return new Response("プレビュー生成に失敗しました", { status: 500 });
  }
}
