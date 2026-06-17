"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export function DeleteDigitalContentButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/digital-contents/${id}`, {
          method: "DELETE",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error?.message ?? "削除に失敗しました");
        }
        show("削除しました");
        setOpen(false);
        router.push("/admin/digital-contents");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "削除に失敗しました");
      }
    });
  };

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        このコンテンツを削除する
      </Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="削除しますか？"
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
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? "削除中..." : "削除する"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          「{title}」を削除します。この操作は取り消せません。
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
