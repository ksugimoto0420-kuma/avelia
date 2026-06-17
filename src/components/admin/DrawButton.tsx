"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { drawLottery } from "@/app/admin/lotteries/actions";

/**
 * 抽選実行ボタン。実行前に確認モーダルで対象者数・当選者数を提示する（仕様書 9 必須）。
 */
export function DrawButton({
  lotteryId,
  title,
  entryCount,
  winnersCount,
  disabled,
}: {
  lotteryId: string;
  title: string;
  entryCount: number;
  winnersCount: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleDraw = () => {
    setError(null);
    const fd = new FormData();
    fd.set("lotteryId", lotteryId);
    startTransition(async () => {
      try {
        await drawLottery(fd);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "抽選の実行に失敗しました");
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        variant={disabled ? "outline" : "primary"}
      >
        抽選実行
      </Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="抽選を実行しますか？"
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
              variant="danger"
              onClick={handleDraw}
              disabled={pending}
            >
              {pending ? "実行中..." : "実行する"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          「{title}」の抽選を実行します。この操作は取り消せません。
        </p>
        <ul className="mt-3 space-y-1 text-sm text-gray-600">
          <li>応募者数: <b>{entryCount}</b> 名</li>
          <li>当選者数: <b>{winnersCount}</b> 名</li>
        </ul>
        {error && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </Modal>
    </>
  );
}
