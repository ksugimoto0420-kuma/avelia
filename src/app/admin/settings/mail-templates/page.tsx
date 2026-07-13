import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { EMAIL_TEMPLATE_SPECS, type TemplateKind } from "@/lib/mail/templates-registry";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "メールテンプレート | 設定" };

/**
 * メールテンプレート一覧。編集済みのものは「カスタム」バッジで示す。
 */
export default async function MailTemplatesPage() {
  await requireAdminPage("MANAGER");

  const customs = await prisma.emailTemplate.findMany({
    select: { kind: true, updatedAt: true },
  });
  const customMap = new Map(customs.map((c) => [c.kind, c.updatedAt]));

  const kinds = Object.keys(EMAIL_TEMPLATE_SPECS) as TemplateKind[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          メールテンプレート
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          自動送信メールの件名・本文を編集できます。編集していない
          メールは既定のデザイン付きテンプレートで送信されます。
        </p>
      </div>

      <Card>
        <CardBody>
          <ul className="divide-y divide-gray-100">
            {kinds.map((kind) => {
              const spec = EMAIL_TEMPLATE_SPECS[kind];
              const updated = customMap.get(kind);
              return (
                <li key={kind} className="py-3">
                  <Link
                    href={`/admin/settings/mail-templates/${kind}`}
                    className="flex flex-wrap items-start justify-between gap-2 hover:bg-gray-50/60 -mx-2 rounded-lg px-2 py-1"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {spec.label}
                        </span>
                        {updated ? (
                          <Badge color="pink">カスタム</Badge>
                        ) : (
                          <Badge color="gray">既定</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {spec.description}
                      </p>
                      {updated && (
                        <p className="mt-1 text-xs text-gray-400">
                          最終更新: {formatDateTime(updated)}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-brand-600">編集 →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
