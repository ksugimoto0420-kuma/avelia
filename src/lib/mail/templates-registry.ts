/**
 * メールテンプレート編集機能のレジストリ (#9 follow-up)。
 *
 * - 種別 (TemplateKind) と、それぞれで使える簡易タグ (TagSpec[]) を一元定義する
 * - 管理画面はこの定義を元にラベル・タグ一覧・プレイスホルダを描画
 * - 送信側 (resolveTemplate) はこの定義に沿って variables を組み立てる
 */

export type TemplateKind =
  | "ORDER_CONFIRMATION"
  | "SIGNATURE_READY_PHOTO"
  | "SIGNATURE_READY_VIDEO"
  | "SHIPPED"
  | "PAYMENT_FAILED"
  | "EVENT_CANCELLED"
  | "EVENT_REMINDER"
  | "LOTTERY_WON"
  | "LOTTERY_LOST"
  | "VERIFY_EMAIL"
  | "PASSWORD_RESET";

/** タグ 1つの定義 (UI 表示用ラベルと変換キー)。 */
export type TagSpec = {
  /** 本文中でのタグキー。例: "userName" → `{{userName}}` */
  key: string;
  /** UI 表示用ラベル。 */
  label: string;
  /** サンプル値 (プレビューで使う)。 */
  sample: string;
};

/**
 * テンプレ全体の仕様。管理画面から参照される。
 */
export type TemplateSpec = {
  kind: TemplateKind;
  /** UI 表示名 (例: 「注文確認メール」) */
  label: string;
  /** 説明文 (どのタイミングで送られるメールか) */
  description: string;
  /** デフォルトの件名 (シード用)。 */
  defaultSubject: string;
  /** デフォルトの本文 (シード用)。 */
  defaultBody: string;
  /** このメールで使えるタグ。 */
  tags: TagSpec[];
};

/** 全メール共通で使えるタグ。 */
const COMMON_TAGS: TagSpec[] = [
  { key: "userName", label: "お客様名", sample: "山田 太郎" },
  {
    key: "siteName",
    label: "サイト名",
    sample: "Avelia FunClub",
  },
];

export const EMAIL_TEMPLATE_SPECS: Record<TemplateKind, TemplateSpec> = {
  ORDER_CONFIRMATION: {
    kind: "ORDER_CONFIRMATION",
    label: "注文確認メール",
    description: "決済成功時に自動送信されます。",
    defaultSubject:
      "【{{siteName}}】ご注文ありがとうございます ({{orderNumber}})",
    defaultBody: `{{userName}} 様

ご注文の決済が完了しました。ご注文内容をご確認ください。

注文番号: {{orderNumber}}
ご注文日時: {{paidAt}}
合計金額: {{totalAmount}}

マイページから注文詳細をご確認いただけます。
{{mypageUrl}}

引き続き {{siteName}} をよろしくお願いいたします。`,
    tags: [
      ...COMMON_TAGS,
      { key: "orderNumber", label: "注文番号", sample: "AV-202607-ABCDEF" },
      { key: "paidAt", label: "支払日時", sample: "2026-07-13 12:34" },
      { key: "totalAmount", label: "合計金額", sample: "¥6,500" },
      {
        key: "mypageUrl",
        label: "マイページURL",
        sample: "https://example.com/mypage/orders/xxx",
      },
    ],
  },
  SIGNATURE_READY_PHOTO: {
    kind: "SIGNATURE_READY_PHOTO",
    label: "サイン完了通知 (写真)",
    description:
      "タレントが写真サインを書き終えた瞬間に自動送信されます。",
    defaultSubject: "【{{siteName}}】サイン入りコンテンツの準備ができました✨",
    defaultBody: `{{userName}} 様

{{artistName}} さんからのサインが届きました。
{{nickname}}宛のご注文分です。

イベント: {{eventTitle}}
商品: {{productName}}

下のリンクから、マイページのデジタルコンテンツを開いてご確認ください。
{{viewUrl}}`,
    tags: [
      ...COMMON_TAGS,
      { key: "artistName", label: "アーティスト名", sample: "推し 太郎" },
      { key: "nickname", label: "宛名", sample: "「たろう」" },
      { key: "eventTitle", label: "イベント名", sample: "夏の特典会2026" },
      { key: "productName", label: "商品名", sample: "直筆サイン写真" },
      {
        key: "viewUrl",
        label: "サイン表示URL",
        sample: "https://example.com/mypage/digital-contents/signed/xxx",
      },
    ],
  },
  SIGNATURE_READY_VIDEO: {
    kind: "SIGNATURE_READY_VIDEO",
    label: "サイン完了通知 (動画)",
    description:
      "タレントが動画サインを書き終えた瞬間に自動送信されます。",
    defaultSubject: "【{{siteName}}】動画サインが届きました🎬",
    defaultBody: `{{userName}} 様

{{artistName}} さんからの動画サインが届きました。
{{nickname}}宛のご注文分です。

イベント: {{eventTitle}}
商品: {{productName}}

下のリンクから、書き込みが重ねられた動画をご覧いただけます。
{{viewUrl}}`,
    tags: [
      ...COMMON_TAGS,
      { key: "artistName", label: "アーティスト名", sample: "推し 太郎" },
      { key: "nickname", label: "宛名", sample: "「たろう」" },
      { key: "eventTitle", label: "イベント名", sample: "夏の特典会2026" },
      { key: "productName", label: "商品名", sample: "動画サイン" },
      {
        key: "viewUrl",
        label: "サイン表示URL",
        sample: "https://example.com/mypage/digital-contents",
      },
    ],
  },
  SHIPPED: {
    kind: "SHIPPED",
    label: "発送完了メール",
    description:
      "管理画面で発送ステータスが SHIPPED になった瞬間に自動送信されます。",
    defaultSubject: "【{{siteName}}】ご注文 {{orderNumber}} を発送しました",
    defaultBody: `{{userName}} 様

ご注文 {{orderNumber}} の商品を発送いたしました。
お手元に届くまで今しばらくお待ちください。

配送会社: {{carrier}}
追跡番号: {{trackingNumber}}

配送状況を確認する:
{{trackingUrl}}

ご注文詳細はマイページからご確認いただけます。
{{orderUrl}}`,
    tags: [
      ...COMMON_TAGS,
      { key: "orderNumber", label: "注文番号", sample: "AV-202607-ABCDEF" },
      { key: "carrier", label: "配送会社", sample: "ヤマト運輸" },
      { key: "trackingNumber", label: "追跡番号", sample: "1234-5678-9012" },
      {
        key: "trackingUrl",
        label: "追跡URL",
        sample: "https://toi.kuronekoyamato.co.jp/...",
      },
      {
        key: "orderUrl",
        label: "注文詳細URL",
        sample: "https://example.com/mypage/orders/xxx",
      },
    ],
  },
  PAYMENT_FAILED: {
    kind: "PAYMENT_FAILED",
    label: "決済失敗通知",
    description:
      "Stripe webhook で決済が失敗したときに送信されます。",
    defaultSubject:
      "【{{siteName}}】ご注文 {{orderNumber}} の決済ができませんでした",
    defaultBody: `{{userName}} 様

ご注文 {{orderNumber}} のお支払い処理が完了しませんでした。

エラー内容: {{reason}}

商品の仮確保は {{reservationExpiresAt}} までとなります。
それを過ぎると再注文が必要です。

下のリンクから決済をやり直してください。
{{retryUrl}}`,
    tags: [
      ...COMMON_TAGS,
      { key: "orderNumber", label: "注文番号", sample: "AV-202607-ABCDEF" },
      {
        key: "reason",
        label: "失敗理由",
        sample: "カード会社側で決済が拒否されました",
      },
      {
        key: "reservationExpiresAt",
        label: "仮確保期限",
        sample: "2026-07-15 23:59",
      },
      {
        key: "retryUrl",
        label: "再決済URL",
        sample: "https://example.com/mypage/orders/xxx",
      },
    ],
  },
  EVENT_CANCELLED: {
    kind: "EVENT_CANCELLED",
    label: "イベント開催中止",
    description:
      "管理画面でイベントを開催中止にした対象注文に送信されます。",
    defaultSubject:
      "【{{siteName}}】「{{eventTitle}}」開催中止のお知らせ",
    defaultBody: `{{userName}} 様

いつも {{siteName}} をご利用いただき、誠にありがとうございます。

誠に申し訳ございませんが、下記イベントは開催中止となりました。
ご購入いただいたご注文はキャンセル扱いとし、お支払いいただいた
金額を全額返金いたします。

対象イベント: {{eventTitle}}
ご注文番号: {{orderNumber}}
返金額: {{refundAmount}}

中止理由:
{{reason}}

ご不明な点がございましたらサポート窓口までご連絡ください。
{{orderUrl}}`,
    tags: [
      ...COMMON_TAGS,
      { key: "eventTitle", label: "イベント名", sample: "夏の特典会2026" },
      { key: "orderNumber", label: "注文番号", sample: "AV-202607-ABCDEF" },
      { key: "refundAmount", label: "返金額", sample: "¥6,500" },
      {
        key: "reason",
        label: "中止理由",
        sample: "出演者の体調不良により…",
      },
      {
        key: "orderUrl",
        label: "注文詳細URL",
        sample: "https://example.com/mypage/orders/xxx",
      },
    ],
  },
  EVENT_REMINDER: {
    kind: "EVENT_REMINDER",
    label: "イベント前日リマインド",
    description:
      "Vercel Cron で「明日開催」のイベント購入者に自動送信されます。",
    defaultSubject: "【{{siteName}}】明日開催: {{eventTitle}}",
    defaultBody: `{{userName}} 様

ご購入いただいた「{{eventTitle}}」が明日開催されます。
当日はお時間に余裕を持ってご参加ください。

開催日時: {{eventDate}}
配信URL: {{streamingUrl}}

ご注文詳細:
{{orderUrl}}`,
    tags: [
      ...COMMON_TAGS,
      { key: "eventTitle", label: "イベント名", sample: "夏の特典会2026" },
      { key: "eventDate", label: "開催日時", sample: "2026-07-14 19:00" },
      {
        key: "streamingUrl",
        label: "配信URL",
        sample: "https://youtube.com/live/xxx",
      },
      {
        key: "orderUrl",
        label: "注文詳細URL",
        sample: "https://example.com/mypage/orders/xxx",
      },
    ],
  },
  LOTTERY_WON: {
    kind: "LOTTERY_WON",
    label: "抽選 当選通知",
    description: "抽選確定時に当選者へ送信されます。",
    defaultSubject: "【{{siteName}}】「{{lotteryTitle}}」当選のお知らせ🎉",
    defaultBody: `{{userName}} 様

ご応募いただいた抽選に当選されました。おめでとうございます!

抽選タイトル: {{lotteryTitle}}
対象イベント: {{eventTitle}}
対象商品: {{productName}}
購入期限: {{purchaseDeadline}}

下のリンクから、購入期限内にお手続きをお願いいたします。
期限を過ぎると当選権利は失効いたします。
{{purchaseUrl}}`,
    tags: [
      ...COMMON_TAGS,
      { key: "lotteryTitle", label: "抽選名", sample: "先行受注抽選" },
      { key: "eventTitle", label: "イベント名", sample: "夏の特典会2026" },
      { key: "productName", label: "対象商品", sample: "限定チェキ" },
      {
        key: "purchaseDeadline",
        label: "購入期限",
        sample: "2026-07-20 23:59",
      },
      {
        key: "purchaseUrl",
        label: "購入手続きURL",
        sample: "https://example.com/products/xxx",
      },
    ],
  },
  LOTTERY_LOST: {
    kind: "LOTTERY_LOST",
    label: "抽選 落選通知",
    description: "抽選確定時に落選者へ送信されます。",
    defaultSubject: "【{{siteName}}】「{{lotteryTitle}}」抽選結果のお知らせ",
    defaultBody: `{{userName}} 様

いつも {{siteName}} をご利用いただき、誠にありがとうございます。

抽選タイトル: {{lotteryTitle}}
対象イベント: {{eventTitle}}

誠に恐れ入りますが、今回はご当選には至りませんでした。
ご応募いただきましたことに、心より感謝申し上げます。

今後もアーティストの魅力をお届けする企画をご用意してまいります。
次回のご応募もぜひお待ちしております。

抽選結果一覧を見る:
{{resultsUrl}}`,
    tags: [
      ...COMMON_TAGS,
      { key: "lotteryTitle", label: "抽選名", sample: "先行受注抽選" },
      { key: "eventTitle", label: "イベント名", sample: "夏の特典会2026" },
      {
        key: "resultsUrl",
        label: "抽選結果URL",
        sample: "https://example.com/mypage/lottery-results",
      },
    ],
  },
  VERIFY_EMAIL: {
    kind: "VERIFY_EMAIL",
    label: "メールアドレス確認",
    description: "新規登録時にメールアドレス確認リンクを送信します。",
    defaultSubject: "【{{siteName}}】メールアドレスの確認をお願いします",
    defaultBody: `{{userName}} 様

{{siteName}} へのご登録ありがとうございます。
下のリンクからメールアドレスの確認をお願いいたします。

{{verifyUrl}}

このリンクは 24 時間有効です。
心当たりのない場合は本メールを破棄してください。`,
    tags: [
      ...COMMON_TAGS,
      {
        key: "verifyUrl",
        label: "確認URL",
        sample: "https://example.com/auth/verify?token=xxx",
      },
    ],
  },
  PASSWORD_RESET: {
    kind: "PASSWORD_RESET",
    label: "パスワード再設定",
    description: "パスワードリセット申請時に送信されます。",
    defaultSubject: "【{{siteName}}】パスワード再設定のご案内",
    defaultBody: `{{userName}} 様

パスワード再設定のリクエストを受け付けました。
下のリンクから新しいパスワードを設定してください。

{{resetUrl}}

このリンクは 1 時間有効です。
心当たりのない場合は本メールを破棄してください。`,
    tags: [
      ...COMMON_TAGS,
      {
        key: "resetUrl",
        label: "再設定URL",
        sample: "https://example.com/auth/reset?token=xxx",
      },
    ],
  },
};

/**
 * `{{key}}` 形式のタグを variables で置換する。
 * 定義されていないタグは `{{key}}` のまま残す (置換漏れが目視で分かるように)。
 */
export function renderTemplate(
  text: string,
  variables: Record<string, string | null | undefined>,
): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = variables[key];
    if (v == null) return `{{${key}}}`;
    return String(v);
  });
}

/**
 * プレビュー用: そのテンプレのタグを全て sample 値で埋めた variables を返す。
 */
export function sampleVariablesFor(kind: TemplateKind): Record<string, string> {
  const spec = EMAIL_TEMPLATE_SPECS[kind];
  return Object.fromEntries(spec.tags.map((t) => [t.key, t.sample]));
}
