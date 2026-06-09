"use client";

import { useState } from "react";
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
        onClose={() => setOpen(false)}
        title="抽選を実行しますか？"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <form action={drawLottery}>
              <input type="hidden" name="lotteryId" value={lotteryId} />
              <Button type="submit" variant="danger">
                実行する
              </Button>
            </form>
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
      </Modal>
    </>
  );
}
