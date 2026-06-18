import type { ContactStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { Badge, type BadgeColor } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { cn, formatDateTime } from "@/lib/utils";
import { updateContactStatus } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ContactStatus, string> = {
  OPEN: "未対応",
  IN_PROGRESS: "対応中",
  RESOLVED: "対応済み",
  SPAM: "スパム",
};
const STATUS_COLOR: Record<ContactStatus, BadgeColor> = {
  OPEN: "yellow",
  IN_PROGRESS: "blue",
  RESOLVED: "green",
  SPAM: "gray",
};

const FILTERS: { key: string; label: string; statuses: ContactStatus[] | null }[] = [
  { key: "open", label: "未対応・対応中", statuses: ["OPEN", "IN_PROGRESS"] },
  { key: "resolved", label: "対応済み", statuses: ["RESOLVED"] },
  { key: "spam", label: "スパム", statuses: ["SPAM"] },
  { key: "all", label: "すべて", statuses: null },
];

const labelCls = "mb-1 block text-xs font-medium text-gray-600";
const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export default async function AdminContactMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.filter) ?? FILTERS[0];
  const q = sp.q?.trim() ?? "";

  const where: Prisma.ContactMessageWhereInput = {};
  if (filter.statuses) where.status = { in: filter.statuses };
  if (q)
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
      { message: { contains: q, mode: "insensitive" } },
    ];

  const [messages, total, openCount] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.count({ where: { status: "OPEN" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">お問い合わせ</h1>
        <p className="text-sm text-gray-500">
          ユーザーから送信されたお問い合わせの一覧。未対応は{openCount}件です。
        </p>
      </div>

      {/* フィルタ + 検索 */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const params = new URLSearchParams();
          if (f.key !== FILTERS[0].key) params.set("filter", f.key);
          if (q) params.set("q", q);
          const qs = params.toString();
          const href = qs
            ? `/admin/contact-messages?${qs}`
            : "/admin/contact-messages";
          return (
            <Link
              key={f.key}
              href={href}
              className={cn(
                "rounded-full px-3 py-1 text-sm",
                f.key === filter.key
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50",
              )}
            >
              {f.label}
            </Link>
          );
        })}
        <form
          method="get"
          action="/admin/contact-messages"
          className="ml-auto flex items-center gap-2"
        >
          {filter.key !== FILTERS[0].key && (
            <input type="hidden" name="filter" value={filter.key} />
          )}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="氏名・メール・件名・本文"
            className="h-9 w-64 rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <button
            type="submit"
            className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            検索
          </button>
        </form>
      </div>
      <p className="text-xs text-gray-400">
        {total} 件中 {messages.length} 件を表示
      </p>

      {/* 一覧 */}
      {messages.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
          該当するお問い合わせはありません
        </p>
      ) : (
        <div className="space-y-4">
          {messages.map((m) => (
            <Card key={m.id}>
              <CardHeader
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge color={STATUS_COLOR[m.status]}>
                      {STATUS_LABEL[m.status]}
                    </Badge>
                    <span>{m.subject || "（件名なし）"}</span>
                  </span>
                }
                subtitle={
                  <span>
                    {m.name}（{m.email}）／ {formatDateTime(m.createdAt)}
                  </span>
                }
              />
              <CardBody className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500">本文</p>
                  <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
                    {m.message}
                  </p>
                </div>

                <form action={updateContactStatus} className="space-y-3">
                  <input type="hidden" name="id" value={m.id} />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr]">
                    <div>
                      <label className={labelCls}>ステータス</label>
                      <select
                        name="status"
                        defaultValue={m.status}
                        className={inputCls}
                      >
                        {(["OPEN", "IN_PROGRESS", "RESOLVED", "SPAM"] as ContactStatus[]).map(
                          (s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>管理メモ（内部用）</label>
                      <input
                        name="adminNote"
                        defaultValue={m.adminNote ?? ""}
                        placeholder="対応者・対応日時など"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                    >
                      更新する
                    </button>
                    <a
                      href={`mailto:${m.email}?subject=${encodeURIComponent(
                        "Re: " + (m.subject || "お問い合わせの件"),
                      )}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      メールで返信する ↗
                    </a>
                  </div>
                </form>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
