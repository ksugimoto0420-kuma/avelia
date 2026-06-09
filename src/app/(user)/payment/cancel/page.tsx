import { Button } from "@/components/ui/Button";

export const metadata = { title: "決済をキャンセルしました" };

export default function PaymentCancelPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 text-3xl">
        !
      </div>
      <h1 className="mt-6 text-2xl font-bold text-gray-900">
        決済をキャンセルしました
      </h1>
      <p className="mt-2 text-gray-500">
        ご注文は確定していません。確保していた在庫は解放されます。
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button href="/cart">カートに戻る</Button>
        <Button href="/events" variant="outline">
          イベントを見る
        </Button>
      </div>
    </div>
  );
}
