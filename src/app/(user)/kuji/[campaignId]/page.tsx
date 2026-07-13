import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * アベリアくじ 詳細ページ。Phase 1 では非表示。
 * 実装は git history に残っている。Phase 2 で戻す際に復元する。
 */
export default async function KujiDetailPage(_props: {
  params: Promise<{ campaignId: string }>;
}) {
  notFound();
}
