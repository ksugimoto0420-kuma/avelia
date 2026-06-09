import Link from "next/link";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "ご注文ありがとうございます" };

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
        ✓
      </div>
      <h1 className="mt-6 text-2xl font-bold text-gray-900">
        ご注文ありがとうございます
      </h1>
      <p className="mt-2 text-gray-500">
        決済が完了しました。確認メールをお送りしています。
      </p>
      {order && (
        <p className="mt-4 inline-block rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
          注文番号: {order}
        </p>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <Button href="/mypage/orders">注文履歴を見る</Button>
        <Link
          href="/"
          className="inline-flex items-center px-4 text-sm text-gray-500 hover:text-brand-600"
        >
          トップに戻る
        </Link>
      </div>
    </div>
  );
}
