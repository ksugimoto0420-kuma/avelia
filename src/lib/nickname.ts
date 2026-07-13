// 数量分のニックネーム（サイン宛名）ユーティリティ

export type UnitNickname = {
  nickname: string | null;
  nicknameKana: string | null;
  note: string | null;
};

/**
 * 任意の入力（JSON値）を quantity 個の UnitNickname 配列に正規化する。
 * 不足分は空、超過分は切り捨て。
 *
 * `fallback` に単一入力 (nickname / nicknameKana) が渡された場合、
 * 「まだ埋まっていない最初の枠」にそれを差し込む。
 *
 * 例) 既存 [{kuma, くま}] に「太郎」を追加すると
 *   → [{kuma, くま}, {太郎, ...}] になる (2個目に落ち着く)
 * 例) 既存 なしで数量2 + 「太郎」を送ると
 *   → [{太郎, ...}, {null, null}] になる (先頭に入る)
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
    const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : "";
    const nicknameKana =
      typeof raw.nicknameKana === "string" ? raw.nicknameKana.trim() : "";
    const note = typeof raw.note === "string" ? raw.note.trim() : "";
    out.push({
      nickname: nickname || null,
      nicknameKana: nicknameKana || null,
      note: note || null,
    });
  }

  // fallback (単一入力) を「未入力の最初の枠」に差し込む。
  // 既存の入力を上書きしないため、追加投入時の挙動が直感的になる。
  const fbNickname = fallback?.nickname?.trim();
  const fbKana = fallback?.nicknameKana?.trim();
  const fbNote = fallback?.note?.trim();
  if (fbNickname || fbKana || fbNote) {
    const idx = out.findIndex((u) => !u.nickname && !u.nicknameKana && !u.note);
    if (idx >= 0) {
      out[idx] = {
        nickname: fbNickname || out[idx].nickname,
        nicknameKana: fbKana || out[idx].nicknameKana,
        note: fbNote || out[idx].note,
      };
    }
  }
  return out;
}

/** 全ユニットにニックネームが入力済みか。 */
export function allUnitsFilled(units: UnitNickname[]): boolean {
  return units.length > 0 && units.every((u) => !!u.nickname?.trim());
}
