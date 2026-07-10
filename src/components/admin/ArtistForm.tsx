import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { saveArtist } from "@/app/admin/artists/actions";
import { ImageUploadField } from "./ImageUploadField";

export type ArtistFormData = {
  id?: string;
  slug: string;
  name: string;
  nameKana: string | null;
  profileText: string | null;
  imageUrl: string | null;
  isPublished: boolean;
};

const labelCls = "mb-1 block text-sm font-medium text-gray-700";
const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function ArtistForm({ artist }: { artist?: ArtistFormData }) {
  return (
    <form action={saveArtist} className="space-y-6">
      {artist?.id && <input type="hidden" name="id" value={artist.id} />}

      <Card>
        <CardHeader title="基本情報" />
        <CardBody className="space-y-4">
          <div>
            <label className={labelCls}>名前 *</label>
            <input
              name="name"
              required
              defaultValue={artist?.name ?? ""}
              className={inputCls}
              placeholder="例: 星野ひなた"
            />
          </div>
          <div>
            <label className={labelCls}>フリガナ</label>
            <input
              name="nameKana"
              defaultValue={artist?.nameKana ?? ""}
              className={inputCls}
              placeholder="例: ホシノヒナタ"
            />
          </div>
          <div>
            <label className={labelCls}>slug（URL識別子・省略可）</label>
            <input
              name="slug"
              defaultValue={artist?.slug ?? ""}
              className={inputCls}
              placeholder="hoshino-hinata"
            />
          </div>
          <div>
            <label className={labelCls}>プロフィール</label>
            <textarea
              name="profileText"
              defaultValue={artist?.profileText ?? ""}
              className={`${inputCls} min-h-28`}
              placeholder="自己紹介・経歴など"
            />
          </div>
          <ImageUploadField
            name="imageUrl"
            defaultValue={artist?.imageUrl ?? ""}
            bucket="public-assets"
            purpose="artist"
            targetId={artist?.id ?? null}
            label="プロフィール画像"
            hint="推奨: 500×500px 以上の正方形 (1:1) JPEG/PNG。プロフィールページでは上側優先で切り取り。顔は画像の上半分に配置してください。"
            previewAspect="square"
          />
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={artist ? artist.isPublished : true}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            公開する（イベントの選択肢に表示）
          </label>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-3">
        <Button href="/admin/artists" variant="outline">
          キャンセル
        </Button>
        <Button type="submit">{artist?.id ? "更新する" : "作成する"}</Button>
      </div>
    </form>
  );
}
