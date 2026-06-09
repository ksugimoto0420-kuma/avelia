import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { deleteFaq, saveFaq, toggleFaqPublish } from "./actions";

export const dynamic = "force-dynamic";

const labelCls = "mb-1 block text-sm font-medium text-gray-700";
const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export default async function AdminFaqsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const sp = await searchParams;

  const [faqs, editing] = await Promise.all([
    prisma.faq.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    sp.edit ? prisma.faq.findUnique({ where: { id: sp.edit } }) : null,
  ]);
  if (sp.edit && !editing) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">よくある質問（FAQ）</h1>
          <p className="text-sm text-gray-500">
            ユーザー側 <code>/faq</code> に公開される内容を編集します。
          </p>
        </div>
      </div>

      {/* 新規 or 編集フォーム */}
      <Card>
        <CardHeader title={editing ? "FAQを編集" : "新しいFAQを追加"} />
        <CardBody>
          <form action={saveFaq} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <label className={labelCls}>質問 *</label>
              <input
                name="question"
                required
                defaultValue={editing?.question ?? ""}
                className={inputCls}
                placeholder="例: 商品はいつ届きますか？"
              />
            </div>
            <div>
              <label className={labelCls}>回答 *</label>
              <textarea
                name="answer"
                required
                rows={4}
                defaultValue={editing?.answer ?? ""}
                className={`${inputCls} min-h-24`}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>表示順（昇順、空欄=0）</label>
                <input
                  type="number"
                  name="sortOrder"
                  defaultValue={editing?.sortOrder ?? 0}
                  className={inputCls}
                />
              </div>
              <label className="flex items-end gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  name="isPublished"
                  defaultChecked={editing ? editing.isPublished : true}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600"
                />
                公開する
              </label>
            </div>
            <div className="flex justify-end gap-3">
              {editing && (
                <Button href="/admin/faqs" variant="outline">
                  キャンセル
                </Button>
              )}
              <Button type="submit">{editing ? "更新する" : "追加する"}</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* 一覧 */}
      <Card>
        <CardHeader
          title={`登録済みFAQ（${faqs.length}件）`}
          subtitle="編集／公開切替／削除"
        />
        <CardBody className="px-0 py-0">
          {faqs.length === 0 ? (
            <p className="px-5 py-12 text-center text-gray-400">
              まだ登録されたFAQはありません
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {faqs.map((f) => (
                <li key={f.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                        順序: {f.sortOrder}
                      </span>
                      {!f.isPublished && (
                        <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-800">
                          非公開
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-semibold text-gray-900">Q. {f.question}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                      A. {f.answer}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      更新：{formatDateTime(f.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <Button
                      href={`/admin/faqs?edit=${f.id}`}
                      variant="outline"
                      size="sm"
                    >
                      編集
                    </Button>
                    <form
                      action={async () => {
                        "use server";
                        await toggleFaqPublish(f.id, !f.isPublished);
                      }}
                    >
                      <Button type="submit" variant="ghost" size="sm">
                        {f.isPublished ? "非公開にする" : "公開する"}
                      </Button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await deleteFaq(f.id);
                      }}
                    >
                      <Button type="submit" variant="danger" size="sm">
                        削除
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
