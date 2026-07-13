import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { EMAIL_TEMPLATE_SPECS, type TemplateKind } from "@/lib/mail/templates-registry";
import { prisma } from "@/lib/prisma";
import { MailTemplateEditor } from "./MailTemplateEditor";

export const dynamic = "force-dynamic";

export default async function MailTemplateEditPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  await requireAdminPage("MANAGER");
  const { kind: rawKind } = await params;
  if (!(rawKind in EMAIL_TEMPLATE_SPECS)) notFound();
  const kind = rawKind as TemplateKind;
  const spec = EMAIL_TEMPLATE_SPECS[kind];

  const current = await prisma.emailTemplate.findUnique({ where: { kind } });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/settings/mail-templates"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← メールテンプレート一覧
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">
          {spec.label}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{spec.description}</p>
      </div>

      <Card>
        <CardHeader
          title="件名・本文"
          subtitle={`{{タグ}} 形式で埋め込むと送信時に自動で置き換わります。空欄で保存すると既定のデザイン付きテンプレートは使えなくなるため、本文は必ず入力してください。`}
        />
        <CardBody>
          <MailTemplateEditor
            kind={kind}
            spec={spec}
            initialSubject={current?.subject ?? spec.defaultSubject}
            initialBody={current?.bodyText ?? spec.defaultBody}
            hasCustom={!!current}
          />
        </CardBody>
      </Card>
    </div>
  );
}
