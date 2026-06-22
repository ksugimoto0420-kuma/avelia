import { requireAdminPage } from "@/lib/auth/admin-page";
import { VideoFrameDemo } from "./VideoFrameDemo";

export const dynamic = "force-dynamic";

export const metadata = { title: "動画フレーム デモ" };

/**
 * 動画フレーム合成デモ（単体）。
 *
 * - 既存の納品・コンテンツ系には一切依存しない、完全に独立したデモ画面。
 * - 「カメラ起動 → フレームを上に重ねる → 録画 → 再生 / ダウンロード」を
 *   ブラウザだけで完結させる。
 * - サーバーには何も送らない（保存・配信は将来 S3 等のストレージを
 *   契約してから接続する想定）。
 */
export default async function AdminVideoDemoPage() {
  await requireAdminPage("OPERATOR");
  return <VideoFrameDemo />;
}
