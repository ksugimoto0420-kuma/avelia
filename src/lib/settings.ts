import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// アプリ全体の設定キー
export type SettingKey =
  | "shippingFlatRate" // 全国一律送料（円）。0以上の整数。
  | "shippingFreeThreshold" // この金額以上で送料無料（円）。0で「無料閾値なし」。
  | "supportEmail" // サポート連絡先（特商法ページ等で利用）
  | "siteName"; // サイト表示名（将来用）

const DEFAULTS: Record<SettingKey, string> = {
  shippingFlatRate: "500",
  shippingFreeThreshold: "5000",
  supportEmail: "support@example.com",
  siteName: "Avelia FunClub",
};

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key];
}

export async function getSettingInt(key: SettingKey): Promise<number> {
  const v = await getSetting(key);
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : Number(DEFAULTS[key]);
}

export async function getAllSettings(): Promise<Record<SettingKey, string>> {
  const rows = await prisma.appSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(
    (Object.keys(DEFAULTS) as SettingKey[]).map((k) => [
      k,
      map.get(k) ?? DEFAULTS[k],
    ]),
  ) as Record<SettingKey, string>;
}

export async function setSetting(
  tx: Prisma.TransactionClient | typeof prisma,
  key: SettingKey,
  value: string,
): Promise<void> {
  await tx.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/**
 * 物販小計から送料を計算する。
 * - shippingFreeThreshold > 0 かつ 小計 >= 閾値 → 0円
 * - そうでなければ shippingFlatRate
 * - 物販がなければ 0
 */
export async function calculateShippingFee(params: {
  physicalSubtotal: number;
  hasPhysical: boolean;
}): Promise<number> {
  if (!params.hasPhysical) return 0;
  const flat = await getSettingInt("shippingFlatRate");
  const threshold = await getSettingInt("shippingFreeThreshold");
  if (threshold > 0 && params.physicalSubtotal >= threshold) return 0;
  return Math.max(0, flat);
}
