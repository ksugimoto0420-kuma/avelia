export type AdminNavItem = { href: string; label: string; icon: string };
export type AdminNavGroup = { title: string; items: AdminNavItem[] };

// Phase 1 (オンライン特典会 = 雑誌サイン / デジタル写真サイン / デジタル動画サイン)
// の運用に不要なメニューはコメントアウトで隠している。
// 該当ページはURL経由では引き続きアクセス可能。
// Phase 2 以降で必要になったらコメントを外すだけで戻せる。
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "概要",
    items: [{ href: "/admin/dashboard", label: "ダッシュボード", icon: "📊" }],
  },
  {
    title: "販売管理",
    items: [
      { href: "/admin/artists", label: "アーティスト", icon: "🎤" },
      { href: "/admin/events", label: "イベント", icon: "🎫" },
      { href: "/admin/products", label: "商品", icon: "🎁" },
      { href: "/admin/inventories", label: "在庫", icon: "📦" },
      { href: "/admin/lotteries", label: "抽選", icon: "🎰" },
      // Phase 1 では非表示。アベリアくじ運用を再開する際にコメントを外す。
      // { href: "/admin/kuji", label: "アベリアくじ", icon: "🎲" },
    ],
  },
  {
    title: "注文・決済",
    items: [
      { href: "/admin/orders", label: "注文", icon: "🧾" },
      { href: "/admin/payments", label: "決済", icon: "💳" },
    ],
  },
  {
    title: "コンテンツ",
    items: [
      // Phase 1 ではデジタルコンテンツは商品作成時に自動生成されるため直接管理しない。
      // 1商品に複数デジタル成果物を紐付ける運用を再開する際にコメントを外す。
      // { href: "/admin/digital-contents", label: "デジタルコンテンツ", icon: "🎬" },
      { href: "/admin/digital-deliveries", label: "サイン納品", icon: "✍️" },
      // 検証用のデモページ。Phase 2 で正式機能化する際にコメントを外す。
      // { href: "/admin/video-demo", label: "動画フレーム デモ", icon: "📹" },
    ],
  },
  {
    title: "ロジ",
    items: [
      { href: "/admin/exports/production-list", label: "制作リスト", icon: "🛠" },
      { href: "/admin/exports/shipping-list", label: "発送リスト", icon: "🚚" },
      { href: "/admin/exports/invoices", label: "納品書一括DL", icon: "📄" },
      // Phase 1 では R/S 売上分配運用は行わない。設定・集計は保持している。
      // { href: "/admin/revenue-shares", label: "R/S売上", icon: "💴" },
    ],
  },
  {
    title: "サイト運営",
    items: [
      { href: "/admin/news", label: "NEWS", icon: "📰" },
      { href: "/admin/faqs", label: "FAQ", icon: "❓" },
      { href: "/admin/contact-messages", label: "お問い合わせ", icon: "✉️" },
    ],
  },
  {
    title: "システム",
    items: [
      { href: "/admin/users", label: "ユーザー", icon: "👥" },
      { href: "/admin/admins", label: "管理者", icon: "🔑" },
      { href: "/admin/settings", label: "サイト設定", icon: "⚙️" },
      {
        href: "/admin/settings/mail-templates",
        label: "メールテンプレ",
        icon: "📧",
      },
      { href: "/admin/operation-logs", label: "操作ログ", icon: "📝" },
      // デバッグ用。Phase 1 運用中は非表示。障害調査時に一時的に戻す。
      // { href: "/admin/mail-debug", label: "メール送信テスト", icon: "📧" },
    ],
  },
];
