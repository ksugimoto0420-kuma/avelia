import Link from "next/link";

export const metadata = { title: "サイン記入完了 | Avelia for Talent" };

export default function TalentDonePage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-5xl">✨</p>
      <h1 className="mt-6 text-2xl font-bold text-gray-900">
        ありがとうございました！
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        書いていただいたサインは、運営側で確認のうえ購入者に納品されます。
        おつかれさまでした。
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/talent"
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700"
        >
          一覧に戻る
        </Link>
      </div>
    </div>
  );
}
