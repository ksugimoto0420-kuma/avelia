"use client";

import { signOut } from "next-auth/react";

export function AdminHeader({
  name,
  role,
}: {
  name: string;
  role: string;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="md:hidden">
        <span className="text-lg font-extrabold text-brand-600">Avelia ADMIN</span>
      </div>
      <div className="flex flex-1 items-center justify-end gap-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-800">{name}</p>
          <p className="text-xs text-gray-400">{role}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          ログアウト
        </button>
      </div>
    </header>
  );
}
