import { requireAdminPage } from "@/lib/auth/admin-page";
import { MailDebugForm } from "./MailDebugForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "メール送信テスト | Admin" };

/**
 * Issue #32 の実接続動作確認用ページ。
 * OPERATOR 以上でログインしていることが必要。
 * 本番運用開始前に削除予定 (Issue #32 完了時のフォローで対応)。
 */
export default async function MailDebugPage() {
  await requireAdminPage("OPERATOR");
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">メール送信テスト</h1>
        <p className="mt-1 text-sm text-gray-500">
          Resend + React Email 経由で 1 通送信します。宛先アドレスを入力して「送信」を押してください。
        </p>
      </div>
      <MailDebugForm />
    </div>
  );
}
