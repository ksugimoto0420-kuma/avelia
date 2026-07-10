import { permanentRedirect } from "next/navigation";

/**
 * #62: トップページ (`/`) がイベント一覧を兼ねるため、旧 /events は廃止し
 * `/` に永久リダイレクトする。将来カテゴリを増やす際に復活させる可能性あり。
 */
export default function EventsPage() {
  permanentRedirect("/");
}
