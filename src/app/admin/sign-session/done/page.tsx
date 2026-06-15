import Link from "next/link";

export const metadata = { title: "サイン記入完了" };

export default function SignSessionDonePage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-5xl">✨</p>
      <h1 className="mt-6 text-2xl font-bold text-gray-900">
        全ての宛先にサインしました
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        書いていただいたサインは、運営側で確認のうえ購入者に納品されます。
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/admin/digital-deliveries"
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700"
        >
          納品管理に戻る
        </Link>
        <Link
          href="/admin/sign-session"
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          もう一度
        </Link>
      </div>
    </div>
  );
}
