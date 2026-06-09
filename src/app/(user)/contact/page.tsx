import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getOptionalUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { submitContact } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "お問い合わせ" };

const labelCls = "mb-1 block text-sm font-medium text-gray-700";
const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const sp = await searchParams;
  const session = await getOptionalUser();
  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.id },
        select: { name: true, email: true },
      })
    : null;

  if (sp.sent === "1") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-bold text-gray-900">お問い合わせ</h1>
        <Card className="mt-8">
          <CardBody>
            <div className="py-6 text-center">
              <p className="text-base font-semibold text-gray-900">
                お問い合わせを受け付けました
              </p>
              <p className="mt-2 text-sm text-gray-600">
                ご入力のメールアドレス宛に自動返信メールをお送りしました。
                <br />
                ご返信まで数営業日いただく場合がございます。
              </p>
              <div className="mt-6">
                <Button href="/" variant="outline">
                  トップへ戻る
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900">お問い合わせ</h1>
      <p className="mt-2 text-sm text-gray-500">
        ご注文・配送・特典会・サイトの不具合などについてご連絡いただけます。
        ご返信まで数営業日いただく場合がございます。
      </p>

      <Card className="mt-8">
        <CardHeader title="お問い合わせフォーム" />
        <CardBody>
          <form action={submitContact} className="space-y-4">
            <div>
              <label className={labelCls}>お名前 *</label>
              <input
                name="name"
                required
                defaultValue={user?.name ?? ""}
                maxLength={100}
                className={inputCls}
                placeholder="山田 太郎"
              />
            </div>
            <div>
              <label className={labelCls}>メールアドレス *</label>
              <input
                type="email"
                name="email"
                required
                defaultValue={user?.email ?? ""}
                maxLength={200}
                className={inputCls}
                placeholder="taro@example.com"
              />
              <p className="mt-1 text-xs text-gray-500">
                返信先となります。お間違いのないようご記入ください。
              </p>
            </div>
            <div>
              <label className={labelCls}>件名</label>
              <input
                name="subject"
                maxLength={200}
                className={inputCls}
                placeholder="例: 注文番号 ORDER-XXXX について"
              />
            </div>
            <div>
              <label className={labelCls}>お問い合わせ内容 *</label>
              <textarea
                name="message"
                required
                minLength={5}
                maxLength={5000}
                rows={8}
                placeholder="ご質問・ご要望をご記入ください"
                className={`${inputCls} min-h-40`}
              />
            </div>
            <p className="text-xs text-gray-500">
              ご送信前に
              <a
                href="/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                プライバシーポリシー
              </a>
              をご確認ください。送信をもって同意いただいたものとみなします。
            </p>
            <div className="flex justify-end">
              <Button type="submit">送信する</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
