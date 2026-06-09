import { notFound } from "next/navigation";
import type { AdminRole } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { auth } from "@/auth";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { deleteAdmin, updateAdmin } from "../actions";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<AdminRole, string> = {
  OWNER: "オーナー",
  MANAGER: "マネージャー",
  OPERATOR: "オペレーター",
  VIEWER: "閲覧者",
};

const labelCls = "mb-1 block text-sm font-medium text-gray-700";
const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export default async function EditAdminPage({
  params,
}: {
  params: Promise<{ adminId: string }>;
}) {
  await requireAdminPage("OWNER");
  const session = await auth();
  const { adminId } = await params;

  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) notFound();

  const isSelf = session?.user?.id === admin.id;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">管理者編集</h1>

      <Card>
        <CardHeader title="管理者情報" />
        <CardBody>
          <form action={updateAdmin} className="space-y-4">
            <input type="hidden" name="id" value={admin.id} />
            <div>
              <label className={labelCls}>メールアドレス</label>
              <input
                type="email"
                value={admin.email}
                disabled
                className={`${inputCls} bg-gray-50`}
              />
              <p className="mt-1 text-xs text-gray-500">
                メールアドレスは変更できません
              </p>
            </div>
            <div>
              <label className={labelCls}>名前 *</label>
              <input
                name="name"
                required
                defaultValue={admin.name}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>ロール *</label>
              <select
                name="role"
                defaultValue={admin.role}
                className={inputCls}
                disabled={isSelf}
              >
                <option value="OWNER">{ROLE_LABEL.OWNER}</option>
                <option value="MANAGER">{ROLE_LABEL.MANAGER}</option>
                <option value="OPERATOR">{ROLE_LABEL.OPERATOR}</option>
                <option value="VIEWER">{ROLE_LABEL.VIEWER}</option>
              </select>
              {isSelf && (
                <p className="mt-1 text-xs text-gray-500">
                  自分自身のロールは変更できません
                </p>
              )}
              {isSelf && <input type="hidden" name="role" value={admin.role} />}
            </div>
            <div>
              <label className={labelCls}>パスワード変更（変更しない場合は空欄）</label>
              <input
                type="password"
                name="password"
                minLength={8}
                placeholder="8文字以上"
                className={inputCls}
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={admin.isActive}
                disabled={isSelf}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              アカウントを有効にする
              {isSelf && (
                <span className="text-xs text-gray-500">
                  （自分自身は無効化できません）
                </span>
              )}
            </label>
            {isSelf && (
              <input type="hidden" name="isActive" value="on" />
            )}
            <div className="flex justify-end gap-3">
              <Button href="/admin/admins" variant="outline">
                キャンセル
              </Button>
              <Button type="submit">更新する</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {!isSelf && (
        <Card className="border-red-200">
          <CardHeader title="削除" />
          <CardBody className="space-y-3">
            <p className="text-sm text-gray-600">
              この管理者アカウントを完全に削除します。操作ログは保持されます（管理者IDは null になります）。
            </p>
            <form action={deleteAdmin}>
              <input type="hidden" name="id" value={admin.id} />
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                この管理者を削除する
              </button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
