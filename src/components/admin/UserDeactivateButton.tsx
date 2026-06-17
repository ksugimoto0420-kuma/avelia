"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { deactivateUser } from "@/app/admin/users/actions";

export function UserDeactivateButton({
  id,
  email,
}: {
  id: string;
  email: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDeactivate = () => {
    setError(null);
    if (confirmText !== email) {
      setError("確認のため、上記メールアドレスを正確に入力してください");
      return;
    }
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      try {
        await deactivateUser(fd);
        show("アカウントを無効化しました");
        setOpen(false);
        router.refresh();
      } catch (e) {
        // server action 内 redirect は NEXT_REDIRECT として throw されるが、
        // それ以外の例外はメッセージを取り出す。NEXT_REDIRECT は無視（成功扱い）。
        if (e instanceof Error && e.message === "NEXT_REDIRECT") return;
        setError(e instanceof Error ? e.message : "退会処理に失敗しました");
      }
    });
  };

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        このアカウントを無効化する
      </Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="アカウントを無効化しますか？"
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
              onClick={handleDeactivate}
              disabled={pending}
            >
              {pending ? "処理中..." : "無効化する"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          このアカウントを退会扱いにします。メールと氏名・住所・電話などの
          個人情報はマスキング・削除され、ログインができなくなります。
          注文・抽選応募・デジタル付与の履歴は残ります。
        </p>
        <p className="mt-3 text-sm text-gray-700">
          確認のため、対象ユーザーのメールアドレス
          <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">
            {email}
          </code>
          を入力してください。
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={email}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          autoComplete="off"
        />
        {error && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </Modal>
    </>
  );
}
