import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { UserDeactivateButton } from "@/components/admin/UserDeactivateButton";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";
import { updateUserProfile } from "../actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "ユーザー詳細 | 管理" };

const LOTTERY_ENTRY_LABEL: Record<
  string,
  { label: string; color: "yellow" | "green" | "gray" | "purple" | "red" }
> = {
  ENTERED: { label: "応募中", color: "yellow" },
  WON: { label: "当選", color: "green" },
  LOST: { label: "落選", color: "gray" },
  PURCHASED: { label: "購入済", color: "purple" },
  EXPIRED: { label: "期限切れ", color: "red" },
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdminPage("MANAGER");
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          payment: true,
          shipment: true,
          items: {
            include: {
              variant: {
                include: { product: { select: { name: true } } },
              },
            },
          },
        },
      },
      lotteryEntries: {
        orderBy: { enteredAt: "desc" },
        include: {
          lottery: {
            include: {
              product: { select: { name: true } },
              event: { select: { title: true } },
            },
          },
        },
      },
      digitalContents: {
        orderBy: { grantedAt: "desc" },
        include: {
          digitalContent: { select: { title: true, type: true } },
        },
      },
    },
  });
  if (!user) notFound();

  const isDeactivated = user.email.endsWith("@deleted.local");
  const paidTotal = user.orders
    .filter((o) => o.status === "PAID")
    .reduce((s, o) => s + o.total, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/users"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← ユーザー一覧
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            {user.name ?? "(名前未登録)"}
          </h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {isDeactivated ? (
            <Badge color="gray">退会済</Badge>
          ) : user.emailVerified ? (
            <Badge color="green">メール認証済</Badge>
          ) : (
            <Badge color="yellow">メール未認証</Badge>
          )}
        </div>
      </div>

      {/* サマリ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="注文数" value={`${user.orders.length}`} />
        <SummaryStat label="購入金額(支払済)" value={formatYen(paidTotal)} />
        <SummaryStat label="抽選応募" value={`${user.lotteryEntries.length}`} />
        <SummaryStat
          label="デジタル付与"
          value={`${user.digitalContents.length}`}
        />
      </div>

      {/* プロフィール編集 */}
      <Card>
        <CardHeader
          title="プロフィール"
          subtitle={
            isDeactivated
              ? "退会処理済のため編集できません"
              : "管理者が代理で会員情報を修正できます"
          }
        />
        <CardBody>
          {isDeactivated ? (
            <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
              退会処理済のため、個人情報は削除されています。
            </p>
          ) : (
            <form
              action={updateUserProfile}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <input type="hidden" name="id" value={user.id} />
              <Field label="氏名" name="name" defaultValue={user.name ?? ""} />
              <Field
                label="フリガナ"
                name="nameKana"
                defaultValue={user.nameKana ?? ""}
              />
              <Field
                label="電話番号"
                name="phone"
                defaultValue={user.phone ?? ""}
              />
              <Field
                label="郵便番号"
                name="postalCode"
                defaultValue={user.postalCode ?? ""}
              />
              <div className="sm:col-span-2">
                <Field
                  label="住所"
                  name="address"
                  defaultValue={user.address ?? ""}
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  プロフィールを更新
                </button>
              </div>
            </form>
          )}
          <dl className="mt-4 grid grid-cols-1 gap-2 border-t border-gray-100 pt-4 text-xs text-gray-500 sm:grid-cols-2">
            <DlRow term="登録日" desc={formatDateTime(user.createdAt)} />
            <DlRow term="更新日" desc={formatDateTime(user.updatedAt)} />
            <DlRow term="ユーザーID" desc={user.id} />
            <DlRow
              term="メール認証"
              desc={
                user.emailVerified
                  ? formatDateTime(user.emailVerified)
                  : "未認証"
              }
            />
          </dl>
        </CardBody>
      </Card>

      {/* 注文履歴 */}
      <Card>
        <CardHeader
          title="購入履歴"
          subtitle={`${user.orders.length} 件の注文`}
        />
        <CardBody>
          {user.orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              注文はありません
            </p>
          ) : (
            <div className="space-y-3">
              {user.orders.map((o) => (
                <div
                  key={o.id}
                  className="rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(o.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge kind="order" status={o.status} />
                      {o.payment && (
                        <StatusBadge kind="payment" status={o.payment.status} />
                      )}
                      {o.shipment && (
                        <StatusBadge
                          kind="shipment"
                          status={o.shipment.status}
                        />
                      )}
                      <span className="font-bold text-gray-900">
                        {formatYen(o.total)}
                      </span>
                    </div>
                  </div>
                  {o.items.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
                      {o.items.map((i) => (
                        <li key={i.id}>
                          ・{i.variant.product.name} / {i.variant.name} ×{" "}
                          {i.quantity}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 抽選応募 */}
      <Card>
        <CardHeader
          title="抽選応募履歴"
          subtitle={`${user.lotteryEntries.length} 件の応募`}
        />
        <CardBody>
          {user.lotteryEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              応募はありません
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">抽選</th>
                    <th className="px-3 py-2 text-left">対象</th>
                    <th className="px-3 py-2 text-left">状態</th>
                    <th className="px-3 py-2 text-left">応募日時</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {user.lotteryEntries.map((e) => {
                    const conf = LOTTERY_ENTRY_LABEL[e.status] ?? {
                      label: e.status,
                      color: "gray" as const,
                    };
                    return (
                      <tr key={e.id}>
                        <td className="px-3 py-2">
                          <Link
                            href={`/admin/lotteries/${e.lottery.id}`}
                            className="text-brand-600 hover:underline"
                          >
                            {e.lottery.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {e.lottery.product?.name ?? e.lottery.event?.title ?? "-"}
                        </td>
                        <td className="px-3 py-2">
                          <Badge color={conf.color}>{conf.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {formatDateTime(e.enteredAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* デジタルコンテンツ付与 */}
      <Card>
        <CardHeader
          title="デジタルコンテンツ付与"
          subtitle={`${user.digitalContents.length} 件`}
        />
        <CardBody>
          {user.digitalContents.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              付与されたコンテンツはありません
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {user.digitalContents.map((g) => (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium text-gray-900">
                      {g.digitalContent.title}
                    </span>
                    <Badge color="purple">{g.digitalContent.type}</Badge>
                  </div>
                  <div className="text-xs text-gray-500">
                    付与: {formatDateTime(g.grantedAt)}
                    {" / DL: "}
                    {g.downloadCount} 回
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* 退会処理 */}
      {!isDeactivated && (
        <Card className="border-red-200">
          <CardHeader
            title="アカウント無効化（退会処理）"
            subtitle="メールと個人情報をマスキングし、ログインを不可能にします"
          />
          <CardBody className="space-y-3">
            <p className="text-sm text-gray-600">
              本人からの退会要請や規約違反対応時にこの処理を行います。
              注文・抽選応募・デジタル付与の履歴は売上・配信責任の追跡のため残します。
              <br />
              <b className="text-red-600">この操作は取り消せません。</b>
            </p>
            <UserDeactivateButton id={user.id} email={user.email} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

function DlRow({ term, desc }: { term: string; desc: string }) {
  return (
    <div className="flex gap-2">
      <dt className="font-medium text-gray-500">{term}</dt>
      <dd className="text-gray-700">{desc}</dd>
    </div>
  );
}
