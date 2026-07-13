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
 * 「まだ埋まっていない枠すべて」にそれを流し込む。
 * 既に埋まっている枠は上書きしない (2回目の追加で別名を入れられる)。
 *
 * 例)
 * - 既存なしで数量2 + 「太郎」で追加
 *   → [{太郎}, {太郎}]  (同じ名前で複数個買う想定)
 * - 既存 [{kuma}] に数量1 + 「太郎」で追加 (合計数量2)
 *   → [{kuma}, {太郎}]  (2個目に太郎が入る)
 * - 既存 [{kuma}, {太郎}] に数量1 + 「三郎」で追加 (合計数量3)
 *   → [{kuma}, {太郎}, {三郎}]
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

  // fallback (単一入力) を「未入力の枠すべて」に流し込む。
  // 既に埋まっている枠は上書きしないので、
  // - 数量2 新規 + 太郎 → [太郎, 太郎] (同じ名前で複数個)
  // - 既存 kuma に太郎追加 → [kuma, 太郎] (kuma は上書きされない)
  const fbNickname = fallback?.nickname?.trim();
  const fbKana = fallback?.nicknameKana?.trim();
  const fbNote = fallback?.note?.trim();
  if (fbNickname || fbKana || fbNote) {
    for (let i = 0; i < out.length; i++) {
      const u = out[i];
      if (u.nickname || u.nicknameKana || u.note) continue;
      out[i] = {
        nickname: fbNickname || null,
        nicknameKana: fbKana || null,
        note: fbNote || null,
      };
    }
  }
  return out;
}

/** 全ユニットにニックネームが入力済みか。 */
export function allUnitsFilled(units: UnitNickname[]): boolean {
  return units.length > 0 && units.every((u) => !!u.nickname?.trim());
}
