export type AdminNavItem = { href: string; label: string; icon: string };
export type AdminNavGroup = { title: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "概要",
    items: [{ href: "/admin/dashboard", label: "ダッシュボード", icon: "📊" }],
  },
  {
    title: "販売管理",
    items: [
      // デモ段階では非表示（運用開始後に復活）
      // { href: "/admin/artists", label: "アーティスト", icon: "🎤" },
      { href: "/admin/events", label: "イベント", icon: "🎫" },
      { href: "/admin/products", label: "商品", icon: "🎁" },
      { href: "/admin/inventories", label: "在庫", icon: "📦" },
      { href: "/admin/lotteries", label: "抽選", icon: "🎰" },
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
      { href: "/admin/digital-contents", label: "デジタルコンテンツ", icon: "🎬" },
      { href: "/admin/digital-deliveries", label: "サイン納品", icon: "✍️" },
      { href: "/admin/video-demo", label: "動画フレーム デモ", icon: "📹" },
    ],
  },
  {
    title: "ロジ",
    items: [
      { href: "/admin/exports/production-list", label: "制作リスト", icon: "🛠" },
      { href: "/admin/exports/shipping-list", label: "発送リスト", icon: "🚚" },
      // デモ段階では非表示（運用開始後に復活）
      // { href: "/admin/revenue-shares", label: "R/S売上", icon: "💴" },
    ],
  },
  {
    title: "サイト運営",
    items: [
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
      { href: "/admin/operation-logs", label: "操作ログ", icon: "📝" },
    ],
  },
];
