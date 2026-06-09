// 数量分のニックネーム（サイン宛名）ユーティリティ

export type UnitNickname = {
  nickname: string | null;
  nicknameKana: string | null;
  note: string | null;
};

/**
 * 任意の入力（JSON値）を quantity 個の UnitNickname 配列に正規化する。
 * 不足分は空、超過分は切り捨て。単一 nickname のフォールバックを先頭に補完する。
 */
export function normalizeUnitNicknames(
  input: unknown,
  quantity: number,
  fallback?: { nickname?: string | null; nicknameKana?: string | null; note?: string | null },
): UnitNickname[] {
  const arr = Array.isArray(input) ? input : [];
  const out: UnitNickname[] = [];
  for (let i = 0; i < quantity; i++) {
    const raw = (arr[i] ?? {}) as Record<string, unknown>;
    let nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : "";
    let nicknameKana =
      typeof raw.nicknameKana === "string" ? raw.nicknameKana.trim() : "";
    const note = typeof raw.note === "string" ? raw.note.trim() : "";
    // 先頭ユニットは単一フィールドのフォールバックを使う
    if (i === 0) {
      if (!nickname && fallback?.nickname) nickname = fallback.nickname.trim();
      if (!nicknameKana && fallback?.nicknameKana)
        nicknameKana = fallback.nicknameKana.trim();
    }
    out.push({
      nickname: nickname || null,
      nicknameKana: nicknameKana || null,
      note: note || null,
    });
  }
  return out;
}

/** 全ユニットにニックネームが入力済みか。 */
export function allUnitsFilled(units: UnitNickname[]): boolean {
  return units.length > 0 && units.every((u) => !!u.nickname?.trim());
}
