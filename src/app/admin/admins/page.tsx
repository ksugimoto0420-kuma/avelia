import type { AdminRole } from "@prisma/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { createAdmin } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "管理者管理" };

const ROLE_LABEL: Record<AdminRole, string> = {
  OWNER: "オーナー",
  MANAGER: "マネージャー",
  OPERATOR: "オペレーター",
  VIEWER: "閲覧者",
  TALENT: "タレント",
};
const ROLE_COLOR: Record<
  AdminRole,
  "purple" | "blue" | "green" | "gray" | "pink"
> = {
  OWNER: "purple",
  MANAGER: "blue",
  OPERATOR: "green",
  VIEWER: "gray",
  TALENT: "pink",
};

const labelCls = "mb-1 block text-sm font-medium text-gray-700";
const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export default async function AdminAdminsPage() {
  await requireAdminPage("OWNER");

  const [admins, artists] = await Promise.all([
    prisma.adminUser.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: { assignedArtist: { select: { name: true } } },
    }),
    prisma.artist.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">管理者管理</h1>
        <p className="text-sm text-gray-500">
          ロール：オーナー（全権） / マネージャー（削除・返金） /
          オペレーター（日常運用） / 閲覧者（読み取りのみ） /
          タレント（/talent サイン記入のみ）
        </p>
      </div>

      <Card>
        <CardHeader title="新しい管理者を追加" />
        <CardBody>
          <form
            action={createAdmin}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div>
              <label htmlFor="new-name" className={labelCls}>
                名前 *
              </label>
              <input
                id="new-name"
                name="name"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="new-email" className={labelCls}>
                メールアドレス *
              </label>
              <input
                id="new-email"
                type="email"
                name="email"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="new-password" className={labelCls}>
                初期パスワード * (8文字以上)
              </label>
              <input
                id="new-password"
                type="password"
                name="password"
                required
                minLength={8}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="new-role" className={labelCls}>
                ロール *
              </label>
              <select
                id="new-role"
                name="role"
                defaultValue="OPERATOR"
                className={inputCls}
              >
                <option value="OWNER">{ROLE_LABEL.OWNER}</option>
                <option value="MANAGER">{ROLE_LABEL.MANAGER}</option>
                <option value="OPERATOR">{ROLE_LABEL.OPERATOR}</option>
                <option value="VIEWER">{ROLE_LABEL.VIEWER}</option>
                <option value="TALENT">{ROLE_LABEL.TALENT}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="new-artist" className={labelCls}>
                担当アーティスト（TALENT の場合のみ）
              </label>
              <select
                id="new-artist"
                name="assignedArtistId"
                defaultValue=""
                className={inputCls}
              >
                <option value="">（未設定）</option>
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">追加する</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`登録済み管理者（${admins.length}件）`} />
        <CardBody className="px-0 py-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 text-left">名前 / メール</th>
                <th className="px-4 py-3 text-left">ロール</th>
                <th className="px-4 py-3 text-left">担当アーティスト</th>
                <th className="px-4 py-3 text-left">状態</th>
                <th className="px-4 py-3 text-left">作成日</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {admins.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{a.name}</p>
                    <p className="text-xs text-gray-500">{a.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={ROLE_COLOR[a.role]}>
                      {ROLE_LABEL[a.role]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {a.role === "TALENT"
                      ? (a.assignedArtist?.name ?? "（未設定）")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {a.isActive ? (
                      <Badge color="green">有効</Badge>
                    ) : (
                      <Badge color="gray">無効</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatDateTime(a.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      href={`/admin/admins/${a.id}`}
                      variant="outline"
                      size="sm"
                    >
                      編集
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
