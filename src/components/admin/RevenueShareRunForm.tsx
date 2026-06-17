"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { runRevenueShare } from "@/app/admin/revenue-shares/actions";

export function RevenueShareRunForm({ defaultPeriod }: { defaultPeriod: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [period, setPeriod] = useState(defaultPeriod);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const value = period.trim();
    if (!value) {
      setError("対象期間を入力してください（例: 2026-06）");
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
      setError("対象期間は YYYY-MM 形式で入力してください（例: 2026-06）");
      return;
    }

    const fd = new FormData();
    fd.set("period", value);
    startTransition(async () => {
      try {
        await runRevenueShare(fd);
        show(`${value} の集計を実行しました`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "集計の実行に失敗しました");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="rs-period"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            対象期間（YYYY-MM）
          </label>
          <input
            id="rs-period"
            name="period"
            type="month"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              if (error) setError(null);
            }}
            placeholder="2026-06"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "集計中..." : "集計を実行"}
        </button>
        <a
          href="/api/admin/exports/revenue-shares"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          CSV出力
        </a>
      </div>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
