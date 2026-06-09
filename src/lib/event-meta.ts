import type { EventType, SaleMethod } from "@prisma/client";
import type { BadgeColor } from "@/components/ui/Badge";

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  MEET_GREET: "オンライン特典会",
  KUJI: "すきくじ",
  TRADING_CARD: "トレカ",
  GOODS: "グッズ",
};

export const EVENT_TYPE_COLOR: Record<EventType, BadgeColor> = {
  MEET_GREET: "pink",
  KUJI: "purple",
  TRADING_CARD: "blue",
  GOODS: "gray",
};

export const SALE_METHOD_LABEL: Record<SaleMethod, string> = {
  FIRST_COME: "先着",
  LOTTERY: "抽選",
};

export const SALE_METHOD_COLOR: Record<SaleMethod, BadgeColor> = {
  FIRST_COME: "green",
  LOTTERY: "purple",
};
