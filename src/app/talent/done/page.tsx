import Link from "next/link";

export const metadata = { title: "サイン記入完了 | Avelia for Talent" };

export default function TalentDonePage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl">✨</p>
      <h1 className="mt-6 text-3xl font-bold text-gray-900">
        ありがとうございました！
      </h1>
      <p className="mt-3 text-base text-gray-500">
        書いていただいたサインは即時、購入者にメールで通知されます。
        おつかれさまでした。
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/talent"
          className="inline-flex h-14 items-center justify-center rounded-xl bg-brand-600 px-8 text-base font-bold text-white shadow hover:bg-brand-700"
        >
          一覧に戻る
        </Link>
      </div>
    </div>
  );
}
