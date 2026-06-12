// 販売ステータス判定ロジック（仕様書 6. 販売機能仕様）

export type SaleStatus =
  | "UNPUBLISHED" // 非公開
  | "BEFORE_SALE" // 販売前
  | "ON_SALE" // 販売中
  | "ENDED" // 販売終了
  | "SOLD_OUT"; // 売切

export type SaleWindowInput = {
  isPublished: boolean;
  saleStartAt: Date | null;
  saleEndAt: Date | null;
  /** null=在庫管理なし、数値=利用可能在庫 */
  available?: number | null;
};

/**
 * 商品/イベントの現在の販売ステータスを返す。
 * 期間とフラグのみで判定し、SOLD_OUT 判定は available を見る。
 */
export function getSaleStatus(
  input: SaleWindowInput,
  now: Date = new Date(),
): SaleStatus {
  if (!input.isPublished) return "UNPUBLISHED";
  if (input.saleStartAt && now < input.saleStartAt) return "BEFORE_SALE";
  if (input.saleEndAt && now > input.saleEndAt) return "ENDED";
  if (input.available != null && input.available <= 0) return "SOLD_OUT";
  return "ON_SALE";
}

export function isPurchasable(
  input: SaleWindowInput,
  now: Date = new Date(),
): boolean {
  return getSaleStatus(input, now) === "ON_SALE";
}

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  UNPUBLISHED: "非公開",
  BEFORE_SALE: "販売前",
  ON_SALE: "販売中",
  ENDED: "販売終了",
  SOLD_OUT: "売切",
};

export const SALE_STATUS_COLOR: Record<
  SaleStatus,
  "gray" | "green" | "yellow" | "red" | "blue"
> = {
  UNPUBLISHED: "gray",
  BEFORE_SALE: "blue",
  ON_SALE: "green",
  ENDED: "gray",
  SOLD_OUT: "red",
};

import type { Prisma } from "@prisma/client";

/** Eventを「販売中→販売予定→終了」に分類するためのwhere句 */
export function eventStageWhere(
  stage: "on_sale" | "upcoming" | "ended",
  now: Date,
): Prisma.EventWhereInput {
  if (stage === "on_sale") {
    return {
      AND: [
        { OR: [{ saleStartAt: null }, { saleStartAt: { lte: now } }] },
        { OR: [{ saleEndAt: null }, { saleEndAt: { gte: now } }] },
      ],
    };
  }
  if (stage === "upcoming") {
    return { saleStartAt: { gt: now } };
  }
  // ended
  return { saleEndAt: { lt: now } };
}

/** 各ステージ内での並び順 */
export const eventStageOrderBy = {
  on_sale: [{ saleEndAt: "asc" as const }, { createdAt: "desc" as const }],
  upcoming: [{ saleStartAt: "asc" as const }, { createdAt: "desc" as const }],
  ended: [{ saleEndAt: "desc" as const }, { createdAt: "desc" as const }],
};
