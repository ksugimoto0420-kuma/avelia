"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

const ROLE_LABEL: Record<string, string> = {
  TALENT: "タレント",
  MANAGER: "管理者（プレビュー）",
  OWNER: "オーナー（プレビュー）",
};

export function TalentHeader({
  name,
  role,
}: {
  name: string;
  role: string;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-brand-100/60 bg-white/80 px-4 backdrop-blur md:px-6">
      <Link href="/talent" className="flex items-center gap-2">
        <span className="text-lg font-extrabold text-brand-600">Avelia</span>
        <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">
          for TALENT
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-gray-800">{name}</p>
          <p className="text-xs text-gray-400">{ROLE_LABEL[role] ?? role}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/talent/login" })}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          ログアウト
        </button>
      </div>
    </header>
  );
}
