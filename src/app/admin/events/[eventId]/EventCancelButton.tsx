"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  cancelEvent,
  previewEventCancel,
  type EventCancelPreview,
  type EventCancelResult,
} from "../cancel-actions";

/**
 * イベント開催中止ボタン (#42)。
 * クリック → プレビュー (対象注文数 + 返金総額) → 理由入力 → 実行 の3段階。
 */
export function EventCancelButton({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<EventCancelPreview | null>(null);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<EventCancelResult | null>(null);
  const [pending, startTransition] = useTransition();

  const openModal = () => {
    setResult(null);
    setPreview(null);
    setOpen(true);
    startTransition(async () => {
      try {
        const p = await previewEventCancel(eventId);
        setPreview(p);
      } catch (e) {
        show(e instanceof Error ? e.message : "確認に失敗しました");
        setOpen(false);
      }
    });
  };

  const doCancel = () => {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("eventId", eventId);
        if (reason.trim()) fd.set("reason", reason.trim());
        const res = await cancelEvent(fd);
        setResult(res);
        if (res.failures.length === 0) {
          show(
            `${res.refundedCount}件の注文を返金しました${res.eventUnpublished ? "・イベントを非公開化しました" : ""}`,
          );
        } else {
          show(
            `${res.refundedCount}件成功 / ${res.failures.length}件失敗しました`,
          );
        }
        router.refresh();
      } catch (e) {
        show(e instanceof Error ? e.message : "実行に失敗しました");
      }
    });
  };

  return (
    <>
      <Button variant="danger" onClick={openModal}>
        🛑 イベントを開催中止にする
      </Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={result ? "実行結果" : "イベントを開催中止にしますか？"}
        footer={
          result ? (
            <Button variant="outline" onClick={() => setOpen(false)}>
              閉じる
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                キャンセル
              </Button>
              <Button
                variant="danger"
                onClick={doCancel}
                disabled={pending || !preview}
              >
                {pending
                  ? "処理中..."
                  : preview
                    ? `${preview.targetOrderCount}件を返金して中止する`
                    : "中止する"}
              </Button>
            </>
          )
        }
      >
        {result ? (
          <div className="space-y-2 text-sm">
            <p>
              返金成功:{" "}
              <span className="font-semibold text-green-700">
                {result.refundedCount}件
              </span>
            </p>
            {result.failures.length > 0 && (
              <>
                <p className="text-red-700">
                  失敗: {result.failures.length}件
                </p>
                <ul className="max-h-40 space-y-1 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {result.failures.map((f) => (
                    <li key={f.orderId}>
                      <span className="font-mono">{f.orderNumber}</span>:{" "}
                      {f.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {result.eventUnpublished && (
              <p className="text-gray-600 text-xs">
                イベントを非公開に切り替えました。
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              「<b>{eventTitle}</b>」を開催中止扱いにします。以下を実行します:
            </p>
            <ul className="ml-4 list-disc space-y-1 text-sm text-gray-700">
              <li>対象の支払済注文を Stripe で全額返金</li>
              <li>DigitalDelivery: 未制作は削除、納品済はDL停止</li>
              <li>イベントを非公開化 (新規購入を止める)</li>
              <li>対象ファンに開催中止メールを送信 (理由を含めて)</li>
            </ul>
            {preview ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                対象注文:{" "}
                <span className="font-semibold">
                  {preview.targetOrderCount}件
                </span>
                {" / "}
                返金総額:{" "}
                <span className="font-semibold">
                  ¥{preview.totalRefundAmount.toLocaleString("ja-JP")}
                </span>
              </div>
            ) : (
              <p className="text-xs text-gray-500">対象を確認中...</p>
            )}
            <div>
              <label
                htmlFor="cancel-reason"
                className="mb-1 block text-xs font-semibold text-gray-700"
              >
                お客様への案内文 (任意)
              </label>
              <textarea
                id="cancel-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="例) 出演者の体調不良により、誠に恐れ入りますが本イベントは開催中止とさせていただきます。"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                空欄でも送信可能です (定型文のみ)。
              </p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
