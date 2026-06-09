import { Card, CardBody } from "@/components/ui/Card";

export const metadata = { title: "プライバシーポリシー" };

type Section = { heading: string; body: string };

const SECTIONS: Section[] = [
  {
    heading: "1. 取得する個人情報",
    body: `当ショップでは、サービス提供のため以下の個人情報を取得します。
・氏名、フリガナ、メールアドレス、電話番号、住所
・サイン宛名（ニックネーム）等の制作・配信に必要な情報
・購入履歴、お問い合わせ内容
・クレジットカード情報については決済代行事業者が取得し、当ショップでは保持しません。`,
  },
  {
    heading: "2. 利用目的",
    body: `取得した個人情報は以下の目的で利用します。
・商品の発送、サイン制作、オンライン特典会の運営
・本人確認、契約の履行、決済処理
・お問い合わせ・ご連絡への対応
・サービス改善のための統計分析（個人を特定しない形）
・重要なお知らせ・サービス変更の通知`,
  },
  {
    heading: "3. 第三者提供",
    body: `法令に基づく場合を除き、ご本人の同意なく個人情報を第三者に提供しません。ただし、業務遂行に必要な範囲で以下の事業者に委託する場合があります。
・決済代行事業者（クレジットカード決済の処理）
・配送事業者（商品の配送）
・ホスティング事業者（データの保管）`,
  },
  {
    heading: "4. 個人情報の安全管理",
    body: "個人情報への不正アクセス、紛失、改ざん、漏えい等を防止するため、SSL/TLSによる通信暗号化、アクセス権限管理、定期的なセキュリティ対策の実施など、合理的な安全管理措置を講じます。",
  },
  {
    heading: "5. 開示・訂正・削除等のご請求",
    body: "ご本人から個人情報の開示・訂正・利用停止・削除のご請求があった場合は、ご本人であることを確認のうえ、合理的な期間内に対応いたします。お問い合わせ窓口までご連絡ください。",
  },
  {
    heading: "6. Cookieの利用",
    body: "当ショップでは、サービス向上のためCookieを利用します。Cookieはお客様を特定する情報ではなく、ブラウザの設定で無効化できますが、その場合一部機能がご利用いただけない場合があります。",
  },
  {
    heading: "7. お問い合わせ窓口",
    body: `本ポリシーに関するお問い合わせは下記までご連絡ください。
（運営会社名）／個人情報保護管理者
メール：support@example.com`,
  },
  {
    heading: "8. 改定",
    body: "本ポリシーは、法令の改正やサービスの変更に伴い予告なく変更する場合があります。重要な変更がある場合はサイト上で告知します。",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900">プライバシーポリシー</h1>
      <p className="mt-2 text-sm text-gray-500">
        制定日：（公開日を記載） / 最終更新日：（最終更新日を記載）
      </p>

      <div className="mt-8 space-y-4">
        {SECTIONS.map((s) => (
          <Card key={s.heading}>
            <CardBody>
              <h2 className="font-semibold text-gray-900">{s.heading}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {s.body}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-xs text-gray-400">
        ※ 本ポリシー中の「（◯◯を記載）」は公開前に運営事業者の情報に差し替えてください。
      </p>
    </div>
  );
}
