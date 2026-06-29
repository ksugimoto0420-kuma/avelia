import { requireAdminPage } from "@/lib/auth/admin-page";
import { PhotobookDemo } from "./PhotobookDemo";

export const dynamic = "force-dynamic";

export const metadata = { title: "サイン入り写真集 デモ" };

/**
 * サイン入り写真集 デモ（単体・社内検証用）。
 *
 * - PDFをブラウザでアップロード
 * - 任意ページにサインを描いて配置
 * - 「電子書籍ビューワ」モード（見開き / 縦スクロール 切替）で閲覧
 * - サーバーには何も送らない（ブラウザ完結）
 *
 * 目的:
 *   自社開発で電子書籍ビューワがどこまで作れるかの技術検証。
 *   ベース写真集にサインを重ねた状態で、実際の閲覧体験を確認する。
 */
export default async function AdminPhotobookDemoPage() {
  await requireAdminPage("OPERATOR");
  return <PhotobookDemo />;
}
