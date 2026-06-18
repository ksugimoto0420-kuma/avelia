"use client";

import { useMemo, useState } from "react";
import { CsvPreviewBar } from "@/components/admin/CsvPreviewBar";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

export type EventWithMembers = {
  id: string;
  title: string;
  artistName: string | null;
  memberNames: string[]; // バリアント名（メンバー名・サイズ等）のユニーク一覧
};

/**
 * 制作リスト CSV 出力のためのピッカー。
 * - イベントを選択（必須にせず「すべて」も選択可）
 * - 選択イベント配下のメンバー（バリアント名）をチェックボックスで絞り込み
 * - クエリを組み立てて /api/admin/exports/production-list?eventId=&variantNames= を開く
 */
export function ProductionListPicker({ events }: { events: EventWithMembers[] }) {
  const [eventId, setEventId] = useState<string>("");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

  const currentEvent = useMemo(
    () => events.find((e) => e.id === eventId) ?? null,
    [events, eventId],
  );

  const memberOptions = currentEvent?.memberNames ?? [];

  function toggleMember(name: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function selectAllMembers() {
    setSelectedMembers(new Set(memberOptions));
  }

  function clearMembers() {
    setSelectedMembers(new Set());
  }

  // イベントを変えたら、選択メンバーは初期化
  function onEventChange(v: string) {
    setEventId(v);
    setSelectedMembers(new Set());
  }

  const downloadHref = useMemo(() => {
    const params = new URLSearchParams();
    if (eventId) params.set("eventId", eventId);
    if (selectedMembers.size > 0) {
      params.set("variantNames", Array.from(selectedMembers).join(","));
    }
    const qs = params.toString();
    return qs
      ? `/api/admin/exports/production-list?${qs}`
      : "/api/admin/exports/production-list";
  }, [eventId, selectedMembers]);

  const previewHref = useMemo(() => {
    const params = new URLSearchParams();
    if (eventId) params.set("eventId", eventId);
    if (selectedMembers.size > 0) {
      params.set("variantNames", Array.from(selectedMembers).join(","));
    }
    params.set("preview", "1");
    return `/api/admin/exports/production-list?${params.toString()}`;
  }, [eventId, selectedMembers]);

  return (
    <div className="space-y-5">
      <div>
        <label
          htmlFor="prod-event"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          イベント
        </label>
        <SearchableSelect
          id="prod-event"
          value={eventId}
          onChange={onEventChange}
          allowEmpty
          emptyLabel="すべてのイベント"
          emptyValue=""
          placeholder="イベントを選択"
          searchPlaceholder="アーティスト名やイベント名で検索…"
          options={events.map((e) => ({
            value: e.id,
            label: e.artistName ? `${e.artistName} / ${e.title}` : e.title,
            hint: e.artistName ?? undefined,
          }))}
        />
      </div>

      {eventId && (
        <div>
          <div className="mb-2 flex items-end justify-between">
            <label className="text-sm font-medium text-gray-700">
              タレント（メンバー）で絞り込み
            </label>
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={selectAllMembers}
                className="text-brand-600 hover:underline"
                disabled={memberOptions.length === 0}
              >
                すべて選択
              </button>
              <button
                type="button"
                onClick={clearMembers}
                className="text-gray-500 hover:underline"
                disabled={selectedMembers.size === 0}
              >
                クリア
              </button>
            </div>
          </div>
          {memberOptions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
              このイベントには商品（メンバー）が登録されていません
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {memberOptions.map((name) => {
                const active = selectedMembers.has(name);
                return active ? (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleMember(name)}
                    aria-pressed="true"
                    className="rounded-full border-2 border-brand-600 bg-brand-600 px-3 py-1 text-xs font-semibold text-white"
                  >
                    {name}
                  </button>
                ) : (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleMember(name)}
                    aria-pressed="false"
                    className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-brand-400 hover:text-brand-600"
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500">
            未選択の場合はイベント内すべての商品が対象になります。
          </p>
        </div>
      )}

      <div className="space-y-2 border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-500">
          {eventId
            ? selectedMembers.size === 0
              ? "選択中のイベント全体を出力します"
              : `選択中: ${selectedMembers.size} 名のタレントで絞り込み`
            : "全イベント・全商品を出力します"}
        </p>
        <CsvPreviewBar
          previewUrl={previewHref}
          downloadUrl={downloadHref}
        />
      </div>
    </div>
  );
}
