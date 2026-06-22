"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import {
  bulkPinEntries,
  clearAllPins,
  drawLottery,
  setEntryPinned,
} from "@/app/admin/lotteries/actions";

/**
 * 抽選候補テーブル + 事前指名 + ハイブリッド抽選パネル。
 *
 * 仕様:
 *   - 候補は ENTERED の応募のみ
 *   - 列ごとに昇/降ソート
 *   - 複合条件で絞り込み（性別/購入回数/累計購入額/会員年数/応募日時）
 *   - 各行のチェックボックスで指名トグル
 *   - 「絞り込み中の全員を指名」「指名を全解除」一括操作
 *   - 当選枠を超える指名はサーバー側で拒否される。UI でもサマリで明示。
 *   - 抽選実行はサマリ確認の上、モーダル経由。指名 + 残り枠ガチ抽選を一括実行。
 */

export type Candidate = {
  entryId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    gender: "MALE" | "FEMALE" | "OTHER" | "UNDISCLOSED" | null;
    joinedAt: string | null; // ISO string
  };
  enteredAt: string;
  orderCount: number;
  totalSpent: number;
  membershipDays: number; // joinedAt or createdAt からの経過日数
  pinned: boolean;
  pinReason: string | null;
};

type SortKey =
  | "enteredAt"
  | "orderCount"
  | "totalSpent"
  | "membershipDays"
  | "name";

type FilterRule = {
  id: string;
  field: "gender" | "orderCount" | "totalSpent" | "membershipDays" | "name";
  op: "eq" | "ne" | "gte" | "lte" | "contains";
  value: string;
};

type Combinator = "AND" | "OR";

const GENDER_LABEL: Record<string, string> = {
  MALE: "男性",
  FEMALE: "女性",
  OTHER: "その他",
  UNDISCLOSED: "未公開",
};

function formatYen(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function matches(rule: FilterRule, c: Candidate): boolean {
  switch (rule.field) {
    case "gender":
      return rule.op === "eq"
        ? (c.user.gender ?? "") === rule.value
        : (c.user.gender ?? "") !== rule.value;
    case "name": {
      const name = (c.user.name ?? "") + " " + c.user.email;
      const v = rule.value.trim();
      if (!v) return true;
      return rule.op === "contains"
        ? name.toLowerCase().includes(v.toLowerCase())
        : name.toLowerCase() === v.toLowerCase();
    }
    case "orderCount":
    case "totalSpent":
    case "membershipDays": {
      const num = Number(rule.value);
      if (Number.isNaN(num)) return true; // 数値未入力時はマッチ扱いでスルー
      const left = c[rule.field];
      switch (rule.op) {
        case "eq":
          return left === num;
        case "ne":
          return left !== num;
        case "gte":
          return left >= num;
        case "lte":
          return left <= num;
        default:
          return true;
      }
    }
  }
}

export function LotteryDraftPanel({
  lotteryId,
  lotteryTitle,
  winnersCount,
  canDraw,
  drawBlockReason,
  candidates,
}: {
  lotteryId: string;
  lotteryTitle: string;
  winnersCount: number;
  canDraw: boolean;
  drawBlockReason: string | null;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("enteredAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [combinator, setCombinator] = useState<Combinator>("AND");
  const [reason, setReason] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (rules.length === 0) return candidates;
    return candidates.filter((c) => {
      const checks = rules.map((r) => matches(r, c));
      return combinator === "AND" ? checks.every(Boolean) : checks.some(Boolean);
    });
  }, [candidates, rules, combinator]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === "enteredAt") {
        av = a.enteredAt;
        bv = b.enteredAt;
      } else if (sortKey === "name") {
        av = (a.user.name ?? a.user.email).toLowerCase();
        bv = (b.user.name ?? b.user.email).toLowerCase();
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const pinnedCount = candidates.filter((c) => c.pinned).length;
  const remainingSlots = Math.max(0, winnersCount - pinnedCount);
  const randomEligible = candidates.filter((c) => !c.pinned).length;
  const overPinned = pinnedCount > winnersCount;

  const filteredPinned = filtered.filter((c) => c.pinned).length;
  const filteredUnpinned = filtered.filter((c) => !c.pinned).length;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const addRule = () => {
    setRules((rs) => [
      ...rs,
      {
        id: Math.random().toString(36).slice(2),
        field: "gender",
        op: "eq",
        value: "FEMALE",
      },
    ]);
  };
  const removeRule = (id: string) =>
    setRules((rs) => rs.filter((r) => r.id !== id));
  const updateRule = (id: string, patch: Partial<FilterRule>) =>
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const handlePin = (entryId: string, pinned: boolean) => {
    setError(null);
    const fd = new FormData();
    fd.set("entryId", entryId);
    fd.set("pinned", String(pinned));
    if (reason) fd.set("reason", reason);
    startTransition(async () => {
      try {
        await setEntryPinned(fd);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "指名に失敗しました");
      }
    });
  };

  const handleBulkPin = () => {
    setError(null);
    const targets = filtered.filter((c) => !c.pinned).map((c) => c.entryId);
    if (targets.length === 0) {
      setError("指名対象が0名です");
      return;
    }
    const fd = new FormData();
    fd.set("lotteryId", lotteryId);
    fd.set("entryIds", targets.join(","));
    if (reason) fd.set("reason", reason);
    startTransition(async () => {
      try {
        await bulkPinEntries(fd);
        setBulkOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "一括指名に失敗しました");
      }
    });
  };

  const handleClearAll = () => {
    setError(null);
    const fd = new FormData();
    fd.set("lotteryId", lotteryId);
    startTransition(async () => {
      try {
        await clearAllPins(fd);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "解除に失敗しました");
      }
    });
  };

  const handleDraw = () => {
    setError(null);
    const fd = new FormData();
    fd.set("lotteryId", lotteryId);
    startTransition(async () => {
      try {
        await drawLottery(fd);
        setDrawOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "抽選の実行に失敗しました");
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* 抽選サマリ */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat label="応募" value={`${candidates.length}名`} />
          <SummaryStat label="当選枠" value={`${winnersCount}名`} />
          <SummaryStat
            label="事前指名"
            value={`${pinnedCount}名`}
            tone={overPinned ? "danger" : pinnedCount > 0 ? "info" : "default"}
          />
          <SummaryStat
            label="ガチ抽選"
            value={`${remainingSlots}名 / ${randomEligible}名`}
            sub="残枠 / 抽選対象"
          />
        </div>
        {overPinned && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            指名({pinnedCount}名)が当選枠({winnersCount}名)を超えています。
            実行前に解除してください。
          </p>
        )}
      </div>

      {/* 絞り込み */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-700">
            候補の絞り込み（条件: {rules.length} 件）
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">結合</label>
            <select
              value={combinator}
              onChange={(e) => setCombinator(e.target.value as Combinator)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="AND">AND (全て満たす)</option>
              <option value="OR">OR (どれか満たす)</option>
            </select>
            <Button size="sm" variant="outline" onClick={addRule}>
              + 条件追加
            </Button>
            {rules.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRules([])}
              >
                条件クリア
              </Button>
            )}
          </div>
        </div>
        {rules.length === 0 ? (
          <p className="text-xs text-gray-400">
            条件を追加すると、テーブルが絞り込まれます。
            「絞り込み中の全員を指名」も絞り込み結果に対して動作します。
          </p>
        ) : (
          <ul className="space-y-2">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                <select
                  value={r.field}
                  onChange={(e) =>
                    updateRule(r.id, {
                      field: e.target.value as FilterRule["field"],
                      op: e.target.value === "gender" ? "eq" : r.op,
                      value: e.target.value === "gender" ? "FEMALE" : "",
                    })
                  }
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="gender">性別</option>
                  <option value="orderCount">累計購入回数</option>
                  <option value="totalSpent">累計購入額</option>
                  <option value="membershipDays">会員日数</option>
                  <option value="name">氏名/メール</option>
                </select>
                <select
                  value={r.op}
                  onChange={(e) =>
                    updateRule(r.id, { op: e.target.value as FilterRule["op"] })
                  }
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                >
                  {r.field === "gender" && (
                    <>
                      <option value="eq">が</option>
                      <option value="ne">以外</option>
                    </>
                  )}
                  {r.field === "name" && (
                    <>
                      <option value="contains">を含む</option>
                      <option value="eq">に一致</option>
                    </>
                  )}
                  {(r.field === "orderCount" ||
                    r.field === "totalSpent" ||
                    r.field === "membershipDays") && (
                    <>
                      <option value="gte">以上</option>
                      <option value="lte">以下</option>
                      <option value="eq">に等しい</option>
                      <option value="ne">に等しくない</option>
                    </>
                  )}
                </select>
                {r.field === "gender" ? (
                  <select
                    value={r.value}
                    onChange={(e) => updateRule(r.id, { value: e.target.value })}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="MALE">男性</option>
                    <option value="FEMALE">女性</option>
                    <option value="OTHER">その他</option>
                    <option value="UNDISCLOSED">未公開</option>
                  </select>
                ) : (
                  <input
                    type={r.field === "name" ? "text" : "number"}
                    value={r.value}
                    onChange={(e) => updateRule(r.id, { value: e.target.value })}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                    placeholder={
                      r.field === "totalSpent"
                        ? "10000"
                        : r.field === "orderCount"
                          ? "3"
                          : r.field === "membershipDays"
                            ? "365"
                            : "山田"
                    }
                  />
                )}
                <button
                  type="button"
                  className="ml-auto text-xs text-red-600 hover:underline"
                  onClick={() => removeRule(r.id)}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            絞り込み結果: <b>{filtered.length}</b>名（うち指名済 {filteredPinned} / 未指名 {filteredUnpinned}）
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="指名理由メモ（任意）"
              className="rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
            <Button
              size="sm"
              variant="primary"
              disabled={!canDraw || pending || filteredUnpinned === 0}
              onClick={() => setBulkOpen(true)}
            >
              絞り込み中の未指名を全員指名 ({filteredUnpinned})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canDraw || pending || pinnedCount === 0}
              onClick={handleClearAll}
            >
              指名を全解除
            </Button>
          </div>
        </div>
      </div>

      {/* 候補テーブル */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-12 px-3 py-2 text-center">指名</th>
              <Th
                label="氏名 / メール"
                active={sortKey === "name"}
                dir={sortDir}
                onClick={() => toggleSort("name")}
              />
              <th className="px-3 py-2 text-left">性別</th>
              <Th
                label="累計購入回数"
                active={sortKey === "orderCount"}
                dir={sortDir}
                onClick={() => toggleSort("orderCount")}
                align="right"
              />
              <Th
                label="累計購入額"
                active={sortKey === "totalSpent"}
                dir={sortDir}
                onClick={() => toggleSort("totalSpent")}
                align="right"
              />
              <Th
                label="会員日数"
                active={sortKey === "membershipDays"}
                dir={sortDir}
                onClick={() => toggleSort("membershipDays")}
                align="right"
              />
              <Th
                label="応募日時"
                active={sortKey === "enteredAt"}
                dir={sortDir}
                onClick={() => toggleSort("enteredAt")}
              />
              <th className="px-3 py-2 text-left">指名理由</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  該当する候補がありません
                </td>
              </tr>
            ) : (
              sorted.map((c) => (
                <tr
                  key={c.entryId}
                  className={c.pinned ? "bg-amber-50/60" : "hover:bg-gray-50/60"}
                >
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={c.pinned}
                      disabled={!canDraw || pending}
                      onChange={(e) => handlePin(c.entryId, e.target.checked)}
                      className="h-4 w-4 accent-amber-600"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900">
                      {c.user.name ?? "(名前未登録)"}
                    </p>
                    <p className="text-xs text-gray-500">{c.user.email}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {c.user.gender ? GENDER_LABEL[c.user.gender] : "-"}
                  </td>
                  <td className="px-3 py-2 text-right">{c.orderCount}回</td>
                  <td className="px-3 py-2 text-right">{formatYen(c.totalSpent)}</td>
                  <td className="px-3 py-2 text-right">{c.membershipDays}日</td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {formatDate(c.enteredAt)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {c.pinned ? (
                      <Badge color="yellow">
                        指名{c.pinReason ? `: ${c.pinReason}` : ""}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 抽選実行ボタン */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-700">
              ハイブリッド抽選実行
            </p>
            <p className="text-xs text-gray-500">
              指名 {pinnedCount}名 + ガチ抽選 {remainingSlots}名 = 当選 {pinnedCount + remainingSlots}名
              （応募 {candidates.length}名）
            </p>
          </div>
          <Button
            variant="danger"
            disabled={!canDraw || pending || overPinned}
            onClick={() => setDrawOpen(true)}
            title={drawBlockReason ?? "抽選を実行する"}
          >
            抽選を実行する
          </Button>
        </div>
        {!canDraw && drawBlockReason && (
          <p className="mt-2 text-xs text-gray-500">{drawBlockReason}</p>
        )}
      </div>

      {/* 一括指名 確認モーダル */}
      <Modal
        open={bulkOpen}
        onClose={() => !pending && setBulkOpen(false)}
        title="絞り込み結果を一括指名しますか？"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setBulkOpen(false)}
              disabled={pending}
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              onClick={handleBulkPin}
              disabled={pending}
            >
              {pending ? "処理中..." : "指名する"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          現在の絞り込み結果のうち、まだ指名されていない{" "}
          <b>{filteredUnpinned}</b>名 を事前指名します。
        </p>
        <p className="mt-2 text-xs text-gray-500">
          合計指名数が当選枠（{winnersCount}名）を超える場合は拒否されます。
        </p>
        {reason && (
          <p className="mt-2 text-xs text-gray-500">
            指名理由メモ:「{reason}」
          </p>
        )}
      </Modal>

      {/* 抽選実行 確認モーダル */}
      <Modal
        open={drawOpen}
        onClose={() => !pending && setDrawOpen(false)}
        title="抽選を実行しますか？"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDrawOpen(false)}
              disabled={pending}
            >
              キャンセル
            </Button>
            <Button
              variant="danger"
              onClick={handleDraw}
              disabled={pending}
            >
              {pending ? "実行中..." : "実行する"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          「{lotteryTitle}」の抽選を実行します。この操作は取り消せません。
        </p>
        <ul className="mt-3 space-y-1 text-sm text-gray-600">
          <li>応募者数: <b>{candidates.length}</b> 名</li>
          <li>事前指名 (確定当選): <b>{pinnedCount}</b> 名</li>
          <li>ガチ抽選 (残り枠): <b>{remainingSlots}</b> 名 / 抽選対象 {randomEligible} 名</li>
          <li>合計当選: <b>{pinnedCount + remainingSlots}</b> 名</li>
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          指名された方と、その全リスト（誰が指名したか・指名理由）は操作ログに残ります。
        </p>
      </Modal>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "danger" | "info";
}) {
  const colorBase =
    tone === "danger"
      ? "border-red-200 bg-red-50"
      : tone === "info"
        ? "border-amber-200 bg-amber-50"
        : "border-gray-200 bg-gray-50";
  return (
    <div className={`rounded-lg border ${colorBase} px-3 py-2`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

function Th({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2 text-${align} cursor-pointer select-none`}
      onClick={onClick}
    >
      <span className={active ? "text-brand-700" : ""}>
        {label}
        {active && <span className="ml-1">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}
