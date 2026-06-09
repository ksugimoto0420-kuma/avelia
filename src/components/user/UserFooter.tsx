import Link from "next/link";

export function UserFooter() {
  return (
    <footer className="mt-20 border-t border-gray-100 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row">
          <div>
            <p className="text-lg font-extrabold text-brand-600">
              Avelia FunClub
            </p>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
              アイドル・アーティストのオンライン特典会・サイン会、
              直筆サイン入りグッズ・すきくじ・トレカのファン向けショップ。
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-gray-600">
            <Link href="/events" className="hover:text-brand-600">
              特典会・サイン会
            </Link>
            <Link href="/mypage" className="hover:text-brand-600">
              マイページ
            </Link>
            <Link href="/faq" className="hover:text-brand-600">
              よくある質問
            </Link>
            <Link href="/contact" className="hover:text-brand-600">
              お問い合わせ
            </Link>
            <Link href="/auth/login" className="hover:text-brand-600">
              ログイン
            </Link>
          </nav>
        </div>
        <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
          <Link href="/legal/tokushoho" className="hover:text-brand-600">
            特定商取引法に基づく表記
          </Link>
          <Link href="/legal/privacy" className="hover:text-brand-600">
            プライバシーポリシー
          </Link>
          <Link href="/legal/terms" className="hover:text-brand-600">
            利用規約
          </Link>
        </nav>
        <p className="mt-4 text-xs text-gray-400">
          © {new Date().getFullYear()} Avelia FunClub. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
