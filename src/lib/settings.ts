import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// アプリ全体の設定キー
export type SettingKey =
  | "shippingFlatRate" // 全国一律送料（円）。0以上の整数。
  | "shippingFreeThreshold" // この金額以上で送料無料（円）。0で「無料閾値なし」。
  | "supportEmail" // サポート連絡先（特商法ページ等で利用）
  | "siteName" // サイト表示名
  | "heroImageUrl" // (レガシー) 単一のヒーロー画像URL。#62 で heroImages に移行
  | "heroImages" // #62: トップページのヒーロー画像URL リスト (JSON 配列を string 保存)
  | "paymentFeeRate" // 決済手数料率（小数。例: 0.029 = 2.9%）。SoftBank/Stripe等。
  | "rsTier1Threshold" // R/S 階段制 第1閾値（円）。月次グロス売上のしきい値。
  | "rsTier1Rate" // 第1階段の弊社取り分率（小数。例: 0.03）
  | "rsTier2Threshold" // 第2閾値（円）。これ以上は Tier3 レートに切り替わる
  | "rsTier2Rate" // 第2階段の弊社取り分率
  | "rsTier3Rate" // 第3階段の弊社取り分率
  // 納品書 (Invoice) テンプレート用の発行元情報。docs/orders-invoice-batch-spec.md 2-1
  | "invoiceCompanyName"
  | "invoicePostalCode"
  | "invoiceAddress"
  | "invoicePhone"
  | "invoiceEmail"
  | "invoiceRepresentative"
  | "invoiceFooterMessage";

const DEFAULTS: Record<SettingKey, string> = {
  shippingFlatRate: "500",
  shippingFreeThreshold: "5000",
  supportEmail: "support@example.com",
  siteName: "Avelia FunClub",
  heroImageUrl: "",
  heroImages: "[]",
  paymentFeeRate: "0.029",
  rsTier1Threshold: "1000000",
  rsTier1Rate: "0.03",
  rsTier2Threshold: "5000000",
  rsTier2Rate: "0.05",
  rsTier3Rate: "0.1",
  // 仮の発行元情報。/admin/settings から後で書き換える想定。
  invoiceCompanyName: "株式会社アベリア",
  invoicePostalCode: "150-0001",
  invoiceAddress: "東京都渋谷区神宮前1-1-1",
  invoicePhone: "03-0000-0000",
  invoiceEmail: "support@avelia.example.com",
  invoiceRepresentative: "代表取締役",
  invoiceFooterMessage:
    "このたびはご購入いただき、誠にありがとうございます。",
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

export async function getSettingFloat(key: SettingKey): Promise<number> {
  const v = await getSetting(key);
  const n = Number(v);
  return Number.isFinite(n) ? n : Number(DEFAULTS[key]);
}

/**
 * #62: ヒーロー画像リストを取得する。
 * heroImages が JSON 配列で保存されていればそれを、無ければ旧 heroImageUrl (単一) を
 * 1要素配列にして返す (後方互換)。
 */
export async function getHeroImages(): Promise<string[]> {
  const raw = await getSetting("heroImages");
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const urls = parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
      if (urls.length > 0) return urls;
    }
  } catch {
    // 破損時は旧値にフォールバック
  }
  const legacy = await getSetting("heroImageUrl");
  return legacy ? [legacy] : [];
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

/** 納品書 (Invoice) の発行元情報。UI 側では null 相当を非表示扱いにする。 */
export type InvoiceIssuerInfo = {
  companyName: string;
  postalCode: string;
  address: string;
  phone: string;
  email: string;
  representative: string;
  footerMessage: string;
};

/**
 * 納品書 PDF に載せる発行元情報を一括で取得する。
 * 現状は AppSetting の KV に保存された値 (無ければ DEFAULTS) を返す。
 * /admin/settings 実装後は同じキーで書き換えられる。
 */
export async function getInvoiceIssuerInfo(): Promise<InvoiceIssuerInfo> {
  const [
    companyName,
    postalCode,
    address,
    phone,
    email,
    representative,
    footerMessage,
  ] = await Promise.all([
    getSetting("invoiceCompanyName"),
    getSetting("invoicePostalCode"),
    getSetting("invoiceAddress"),
    getSetting("invoicePhone"),
    getSetting("invoiceEmail"),
    getSetting("invoiceRepresentative"),
    getSetting("invoiceFooterMessage"),
  ]);
  return {
    companyName,
    postalCode,
    address,
    phone,
    email,
    representative,
    footerMessage,
  };
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
