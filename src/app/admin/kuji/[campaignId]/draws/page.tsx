import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * 管理: アベリアくじ 抽選履歴。Phase 1 では非表示。
 * 実装は git history に残っている。Phase 2 で戻す際に復元する。
 */
export default async function KujiDrawsPage(_props: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  notFound();
}
