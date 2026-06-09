import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireUserPage } from "@/lib/auth/user-page";
import { prisma } from "@/lib/prisma";
import { changePassword, updateProfile } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "会員情報" };

const labelCls = "mb-1 block text-sm font-medium text-gray-700";
const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export default async function MypageProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; passwordChanged?: string }>;
}) {
  const sessionUser = await requireUserPage("/mypage/profile");
  const sp = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
  });
  if (!user) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
        会員情報が取得できませんでした
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {sp.saved === "1" && (
        <Alert tone="success" title="会員情報を更新しました" />
      )}
      {sp.passwordChanged === "1" && (
        <Alert tone="success" title="パスワードを変更しました" />
      )}

      <Card>
        <CardHeader title="お客様情報" />
        <CardBody>
          <form action={updateProfile} className="space-y-4">
            <div>
              <label className={labelCls}>メールアドレス</label>
              <input
                value={user.email}
                disabled
                className={`${inputCls} bg-gray-50`}
              />
              <p className="mt-1 text-xs text-gray-500">
                メールアドレスの変更にはサポートまでお問い合わせください
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>お名前</label>
                <input
                  name="name"
                  defaultValue={user.name ?? ""}
                  maxLength={100}
                  className={inputCls}
                  placeholder="山田 太郎"
                />
              </div>
              <div>
                <label className={labelCls}>フリガナ</label>
                <input
                  name="nameKana"
                  defaultValue={user.nameKana ?? ""}
                  maxLength={100}
                  className={inputCls}
                  placeholder="ヤマダ タロウ"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>電話番号</label>
                <input
                  name="phone"
                  defaultValue={user.phone ?? ""}
                  maxLength={20}
                  className={inputCls}
                  placeholder="090-1234-5678"
                />
              </div>
              <div>
                <label className={labelCls}>郵便番号</label>
                <input
                  name="postalCode"
                  defaultValue={user.postalCode ?? ""}
                  maxLength={10}
                  className={inputCls}
                  placeholder="123-4567"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>住所</label>
              <input
                name="address"
                defaultValue={user.address ?? ""}
                maxLength={300}
                className={inputCls}
                placeholder="東京都◯◯区◯◯ 1-2-3"
              />
              <p className="mt-1 text-xs text-gray-500">
                保存した情報はチェックアウト時に自動入力されます
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit">保存する</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="パスワード変更" />
        <CardBody>
          <form action={changePassword} className="space-y-4">
            <div>
              <label className={labelCls}>現在のパスワード *</label>
              <input
                type="password"
                name="currentPassword"
                required
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>新しいパスワード * (8文字以上)</label>
                <input
                  type="password"
                  name="newPassword"
                  required
                  minLength={8}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>新しいパスワード（確認） *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  minLength={8}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit">パスワードを変更する</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
