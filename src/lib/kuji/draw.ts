import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * アベリアくじ抽選ロジック。
 *
 * ハイブリッド在庫モデル:
 *   - LIMITED 賞: remainingCount > 0 のとき排出候補。引かれたら -1。
 *   - PROBABILITY 賞: 在庫なし、weighted 抽選。
 *
 * 1回の抽選フロー:
 *   1) LIMITED 賞のうち残数>0のものから「均等」に1つ選んで取得を試みる
 *      （UPDATE ... WHERE remainingCount > 0 で原子的に -1）
 *   2) 失敗（他購入者に取られた、もしくは LIMITED が全て空）の場合、
 *      PROBABILITY 賞を weighted 抽選で1つ選ぶ
 *   3) どちらも該当しない場合（PROBABILITY 賞が無い等の構成ミス）はエラー
 *
 * 連数まとめ買い特典:
 *   - drawN 回ループで通常抽選 → さらに bundle.bonusPrize があれば +1 で付与
 *   - 連数オマケは通常抽選候補からは除外する（bundleOnly=true を勧告）
 */

export type DrawnRecord = {
  prizeId: string;
  isBundleBonus: boolean;
};

/**
 * 単一トランザクション内で N 回引く。
 * 競合制御は `tx.kujiPrize.updateMany({where: {id, remainingCount: {gt: 0}}})` の
 * 影響行数で判定する。
 */
export async function drawKuji(
  tx: Prisma.TransactionClient,
  campaignId: string,
  drawCount: number,
  bonusPrizeId: string | null,
): Promise<DrawnRecord[]> {
  const results: DrawnRecord[] = [];

  for (let i = 0; i < drawCount; i++) {
    const prizeId = await drawOnce(tx, campaignId);
    results.push({ prizeId, isBundleBonus: false });
  }

  if (bonusPrizeId) {
    // 連数オマケ。LIMITED であれば在庫を減らす、PROBABILITY であればそのまま付与。
    const bonus = await tx.kujiPrize.findUnique({ where: { id: bonusPrizeId } });
    if (!bonus) throw new Error("連数オマケ賞が存在しません");
    if (bonus.type === "LIMITED") {
      const upd = await tx.kujiPrize.updateMany({
        where: {
          id: bonusPrizeId,
          remainingCount: { gt: 0 },
        },
        data: { remainingCount: { decrement: 1 } },
      });
      if (upd.count === 0) {
        throw new Error(
          "連数オマケ賞の在庫が枯渇しているため購入できません。販売を一時停止してください。",
        );
      }
    }
    results.push({ prizeId: bonusPrizeId, isBundleBonus: true });
  }

  return results;
}

/**
 * 1回の抽選。
 *
 * 戦略:
 *   - LIMITED 賞のうち、bundleOnly=false かつ remainingCount > 0 のものを
 *     全件取り出して均等抽選 → updateMany で原子的に在庫を減らす
 *   - 取れたらその ID を返す
 *   - 全て駄目なら PROBABILITY 賞を weighted 抽選
 *
 * 競合: 他購入者と同時に上位賞を引いた場合、updateMany の count が 0 になる。
 * その場合、その賞を候補から外して再試行する。最大 LIMITED 賞数+1 回までリトライ。
 */
async function drawOnce(
  tx: Prisma.TransactionClient,
  campaignId: string,
): Promise<string> {
  // LIMITED の候補（残数のあるもの、bundleOnly を除く）
  const limited = await tx.kujiPrize.findMany({
    where: {
      campaignId,
      type: "LIMITED",
      bundleOnly: false,
      remainingCount: { gt: 0 },
    },
    select: { id: true, remainingCount: true },
  });

  const triedLimited = new Set<string>();
  for (let attempt = 0; attempt < limited.length; attempt++) {
    const candidates = limited.filter((p) => !triedLimited.has(p.id));
    if (candidates.length === 0) break;
    // 残数に比例した重み付きで選ぶ（残数の多い賞ほど出やすい）
    const totalWeight = candidates.reduce(
      (s, p) => s + (p.remainingCount ?? 0),
      0,
    );
    let r = Math.floor(Math.random() * totalWeight);
    let chosen = candidates[0];
    for (const p of candidates) {
      const w = p.remainingCount ?? 0;
      if (r < w) {
        chosen = p;
        break;
      }
      r -= w;
    }

    const upd = await tx.kujiPrize.updateMany({
      where: { id: chosen.id, remainingCount: { gt: 0 } },
      data: { remainingCount: { decrement: 1 } },
    });
    if (upd.count > 0) return chosen.id;
    // 失敗 → 次の候補へ
    triedLimited.add(chosen.id);
  }

  // PROBABILITY 賞（重み付きで抽選）
  const probs = await tx.kujiPrize.findMany({
    where: {
      campaignId,
      type: "PROBABILITY",
      bundleOnly: false,
      probabilityWeight: { gt: 0 },
    },
    select: { id: true, probabilityWeight: true },
  });
  if (probs.length === 0) {
    throw new Error(
      "排出可能な賞がありません。確率制(PROBABILITY)賞を少なくとも1つ設定してください。",
    );
  }
  const total = probs.reduce((s, p) => s + (p.probabilityWeight ?? 0), 0);
  let r = Math.floor(Math.random() * total);
  for (const p of probs) {
    const w = p.probabilityWeight ?? 0;
    if (r < w) return p.id;
    r -= w;
  }
  return probs[probs.length - 1].id;
}

/**
 * フロント表示用の確率テーブルを計算する。
 *   - LIMITED 賞: 残数 / 残販売予定数 で「現状の出やすさ」を出すのは難しいので
 *     現在の totalCount を母数とした表示確率（=設計時の意図）にする
 *   - PROBABILITY 賞: weight / sum(weight) を %表示
 * MVPでは「設定時の意図確率」を出すだけにする。
 */
export type PrizeRatio = {
  prizeId: string;
  rank: string;
  name: string;
  percent: number;
};

export async function calcPrizeRatios(
  prisma: PrismaClient,
  campaignId: string,
): Promise<PrizeRatio[]> {
  const prizes = await prisma.kujiPrize.findMany({
    where: { campaignId, bundleOnly: false },
    orderBy: { order: "asc" },
  });

  // LIMITED 賞は totalCount のうちその賞が占める割合 + PROBABILITY 賞の重み比率を合算
  // 表示は概算なので「LIMITED は残数 / 全 LIMITED 残数」と「PROBABILITY は重みベース」を
  // それぞれの母数で正規化する単純表記にする。
  const limitedTotal = prizes
    .filter((p) => p.type === "LIMITED")
    .reduce((s, p) => s + (p.totalCount ?? 0), 0);
  const probabilityTotal = prizes
    .filter((p) => p.type === "PROBABILITY")
    .reduce((s, p) => s + (p.probabilityWeight ?? 0), 0);
  // LIMITED 賞の予想総排出割合は、設定者が決めた totalCount の比率にする。
  // PROBABILITY 賞は残りパイ（仮にLIMITEDが全部出た後）から weight 比率で割る。
  // この計算は MVP の表示用。実際の挙動は drawOnce が決定する。
  // 仮の母数: LIMITED 合計 + PROBABILITY 合計 = 1.0 として、それぞれ独立に正規化。
  // ハズレなし設計のため、合算 100% にする。
  return prizes.map((p) => {
    let percent = 0;
    if (p.type === "LIMITED") {
      // 母数 (limitedTotal + probabilityTotal) のうちの比率
      const denom = limitedTotal + probabilityTotal;
      percent = denom > 0 ? ((p.totalCount ?? 0) / denom) * 100 : 0;
    } else {
      const denom = limitedTotal + probabilityTotal;
      percent = denom > 0 ? ((p.probabilityWeight ?? 0) / denom) * 100 : 0;
    }
    return {
      prizeId: p.id,
      rank: p.rank,
      name: p.name,
      percent,
    };
  });
}
