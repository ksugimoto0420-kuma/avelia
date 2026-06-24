import { requireAdminPage } from "@/lib/auth/admin-page";
import { SignedVideoDemo } from "./SignedVideoDemo";

export const dynamic = "force-dynamic";

export const metadata = { title: "サイン入り動画 デモ" };

/**
 * サイン入り動画 デモ（単体・社内検証用）。
 *
 * - 既存の納品・コンテンツ系には一切依存しない、独立した単体デモ。
 * - 「動画選択 → 宛名入力 → サイン描画 → 合成プレビュー → DL/共有」を
 *   ブラウザだけで完結させる。
 * - サーバーには何も送らない。S3 等のストレージは契約後に本番化する想定。
 * - 顧客向け公開はまだ早いのでサイドバーから非表示にし、URL直打ちのみ可。
 */
export default async function AdminSignedVideoDemoPage() {
  await requireAdminPage("OPERATOR");
  return <SignedVideoDemo />;
}
