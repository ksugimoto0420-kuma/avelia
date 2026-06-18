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
  TALENT: "タレント",
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

  const [admin, artists] = await Promise.all([
    prisma.adminUser.findUnique({ where: { id: adminId } }),
    prisma.artist.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
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
              <label htmlFor="email" className={labelCls}>
                メールアドレス
              </label>
              <input
                id="email"
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
              <label htmlFor="name" className={labelCls}>
                名前 *
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={admin.name}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="role" className={labelCls}>
                ロール *
              </label>
              <select
                id="role"
                name="role"
                defaultValue={admin.role}
                className={inputCls}
                disabled={isSelf}
              >
                <option value="OWNER">{ROLE_LABEL.OWNER}</option>
                <option value="MANAGER">{ROLE_LABEL.MANAGER}</option>
                <option value="OPERATOR">{ROLE_LABEL.OPERATOR}</option>
                <option value="VIEWER">{ROLE_LABEL.VIEWER}</option>
                <option value="TALENT">{ROLE_LABEL.TALENT}</option>
              </select>
              {isSelf && (
                <p className="mt-1 text-xs text-gray-500">
                  自分自身のロールは変更できません
                </p>
              )}
              {isSelf && <input type="hidden" name="role" value={admin.role} />}
              <p className="mt-1 text-xs text-gray-500">
                TALENT は管理画面に入れず、/talent 配下のサイン記入画面のみ
                利用できます。担当アーティストを下で設定してください。
              </p>
            </div>
            <div>
              <label htmlFor="assignedArtistId" className={labelCls}>
                担当アーティスト（TALENT のみ）
              </label>
              <select
                id="assignedArtistId"
                name="assignedArtistId"
                defaultValue={admin.assignedArtistId ?? ""}
                className={inputCls}
              >
                <option value="">（未設定）</option>
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                ロールが TALENT 以外の場合は無視されます。
              </p>
            </div>
            <div>
              <label htmlFor="password" className={labelCls}>
                パスワード変更（変更しない場合は空欄）
              </label>
              <input
                id="password"
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
