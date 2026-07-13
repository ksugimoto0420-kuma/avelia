import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * アベリアくじ 結果ページ。Phase 1 では非表示。
 * 実装は git history に残っている。Phase 2 で戻す際に復元する。
 */
export default async function KujiResultPage(_props: {
  params: Promise<{ campaignId: string; orderId: string }>;
}) {
  notFound();
}
