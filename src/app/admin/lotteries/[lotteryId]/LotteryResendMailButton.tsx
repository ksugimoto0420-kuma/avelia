"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { resendLotteryResultMails } from "../actions";

/**
 * 抽選結果通知メールの手動再送ボタン (#9)。
 * 送信済みの当選/落選メールは Resend 側の idempotencyKey で重複扱いになるため、
 * 障害後のリカバリや部分再送でも何度でも安全に叩ける。
 */
export function LotteryResendMailButton({
  lotteryId,
  lotteryTitle,
}: {
  lotteryId: string;
  lotteryTitle: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSend = () => {
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("lotteryId", lotteryId);
        const res = await resendLotteryResultMails(fd);
        show(res.message);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "送信に失敗しました");
      }
    });
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        📧 結果メールを再送
      </Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="結果メールを再送しますか？"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              キャンセル
            </Button>
            <Button onClick={handleSend} disabled={pending}>
              {pending ? "送信中..." : "再送する"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          「<b>{lotteryTitle}</b>」の当選者/落選者全員に結果メールを再送します。
        </p>
        <p className="mt-2 text-xs text-gray-500">
          既に届いているユーザーには重複配信されません (Resend の冪等キー)。
          障害後のリカバリなどにご利用ください。応募人数が多い場合は
          数十秒お待ちください。
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
