import { notFound } from "next/navigation";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { requireUserPage } from "@/lib/auth/user-page";
import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/storage";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DigitalContentViewer({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const user = await requireUserPage();
  const { contentId } = await params;

  // 所有権を検証（仕様書 8/15）
  const grant = await prisma.userDigitalContent.findUnique({
    where: {
      userId_digitalContentId: { userId: user.id, digitalContentId: contentId },
    },
    include: { digitalContent: true },
  });
  if (!grant) notFound();

  const content = grant.digitalContent;
  const now = new Date();
  const expired = Boolean(grant.expiresAt && grant.expiresAt < now);
  const notPublished = Boolean(content.publishAt && content.publishAt > now);
  const url = content.fileKey ? await getSignedUrl(content.fileKey) : null;

  return (
    <div className="space-y-5">
      <Link
        href="/mypage/digital-contents"
        className="text-sm text-gray-400 hover:text-brand-600"
      >
        ← 一覧に戻る
      </Link>
      <h2 className="text-xl font-bold text-gray-900">{content.title}</h2>
      {content.description && (
        <p className="text-sm text-gray-600">{content.description}</p>
      )}

      {expired ? (
        <Alert tone="warning" title="閲覧期限が切れています">
          このコンテンツの閲覧期限（{formatDate(grant.expiresAt)}）を過ぎています。
        </Alert>
      ) : notPublished ? (
        <Alert tone="info" title="公開前です">
          {formatDate(content.publishAt)} に公開予定です。
        </Alert>
      ) : !url ? (
        <Alert tone="info" title="準備中です">
          このコンテンツはまだダウンロードできません。
        </Alert>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-black/5 p-4">
          {content.type === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={content.title} className="mx-auto max-h-[70vh]" />
          ) : (
            <div className="py-8 text-center">
              <Button href={url}>ダウンロード</Button>
            </div>
          )}
        </div>
      )}

      {content.downloadLimit != null && (
        <p className="text-xs text-gray-400">
          ダウンロード回数: {grant.downloadCount} / {content.downloadLimit}
        </p>
      )}
    </div>
  );
}
