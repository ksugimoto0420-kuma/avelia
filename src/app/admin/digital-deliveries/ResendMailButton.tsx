"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

/**
 * サイン完了通知メールを再送するボタン。
 * クリック → 確認モーダル → 送信中 → 完了トースト、の一連の UI を持つ。
 */
export function ResendMailButton({ deliveryId }: { deliveryId: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSend = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/digital-deliveries/resend-mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliveryId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error?.message ?? "送信に失敗しました");
        }
        const to = json?.data?.sentTo as string | undefined;
        show(to ? `${to} にメールを再送しました` : "メールを再送しました");
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "送信に失敗しました");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        title="通知メールを再送信します"
      >
        メール再送
      </button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="通知メールを再送しますか？"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={pending}
            >
              {pending ? "送信中..." : "再送する"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          この注文の購入者にサイン完了通知メールを再送します。
        </p>
        {error && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </Modal>
    </>
  );
}
