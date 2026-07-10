import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { saveNewsPost } from "@/app/admin/news/actions";
import { toJstDateTimeLocalString } from "@/lib/utils";

export type NewsPostFormData = {
  id?: string;
  title: string;
  slug: string;
  body: string;
  isPublished: boolean;
  publishedAt: Date | null;
};

const labelCls = "mb-1 block text-sm font-medium text-gray-700";
const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

/**
 * #62: NEWS 投稿の作成/編集フォーム (Server Component)。
 * Server Action saveNewsPost に FormData で送る。
 */
export function NewsPostForm({ post }: { post?: NewsPostFormData }) {
  return (
    <form action={saveNewsPost} className="space-y-6">
      {post?.id && <input type="hidden" name="id" value={post.id} />}

      <Card>
        <CardHeader title="基本情報" />
        <CardBody className="space-y-4">
          <div>
            <label className={labelCls}>タイトル *</label>
            <input
              name="title"
              required
              defaultValue={post?.title ?? ""}
              className={inputCls}
              placeholder="例: サーバーメンテナンスのお知らせ"
            />
          </div>
          <div>
            <label className={labelCls}>slug (URL識別子)</label>
            <input
              name="slug"
              defaultValue={post?.slug ?? ""}
              className={inputCls}
              placeholder="maintenance-2026-08"
            />
            <p className="mt-1 text-xs text-gray-500">
              空欄の場合はタイトルから自動生成します。英小文字・数字・ハイフンのみ。
            </p>
          </div>
          <div>
            <label className={labelCls}>本文 *</label>
            <textarea
              name="body"
              required
              defaultValue={post?.body ?? ""}
              className={`${inputCls} min-h-56`}
              placeholder="本文を入力"
            />
            <p className="mt-1 text-xs text-gray-500">
              改行はそのまま表示されます。
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="公開設定"
          subtitle="公開日を未来にすると、その時刻まで一般ユーザーには非表示になります。"
        />
        <CardBody className="space-y-4">
          <div>
            <label className={labelCls}>公開日時</label>
            <DateTimeField
              name="publishedAt"
              defaultValue={toJstDateTimeLocalString(post?.publishedAt ?? null)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={post ? post.isPublished : true}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            公開する（チェックを外すと下書き扱い）
          </label>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-3">
        <Button href="/admin/news" variant="outline">
          キャンセル
        </Button>
        <Button type="submit">{post?.id ? "更新する" : "作成する"}</Button>
      </div>
    </form>
  );
}
