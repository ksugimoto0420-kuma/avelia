import { Badge, type BadgeColor } from "@/components/ui/Badge";

const ORDER: Record<string, { label: string; color: BadgeColor }> = {
  PENDING: { label: "未決済", color: "yellow" },
  PAID: { label: "支払済", color: "green" },
  CANCELLED: { label: "キャンセル", color: "gray" },
  REFUNDED: { label: "返金済", color: "purple" },
  FAILED: { label: "失敗", color: "red" },
};

const PAYMENT: Record<string, { label: string; color: BadgeColor }> = {
  PENDING: { label: "未決済", color: "yellow" },
  AUTHORIZED: { label: "与信済", color: "blue" },
  PAID: { label: "決済完了", color: "green" },
  FAILED: { label: "失敗", color: "red" },
  CANCELLED: { label: "キャンセル", color: "gray" },
  REFUNDED: { label: "返金済", color: "purple" },
};

const SHIPMENT: Record<string, { label: string; color: BadgeColor }> = {
  UNFULFILLED: { label: "未対応", color: "gray" },
  PREPARING: { label: "準備中", color: "yellow" },
  SHIPPED: { label: "発送済", color: "blue" },
  DELIVERED: { label: "配達完了", color: "green" },
  RETURNED: { label: "返品", color: "red" },
};

const LOTTERY: Record<string, { label: string; color: BadgeColor }> = {
  DRAFT: { label: "下書き", color: "gray" },
  OPEN: { label: "受付中", color: "green" },
  CLOSED: { label: "締切", color: "yellow" },
  DRAWN: { label: "抽選済", color: "purple" },
};

const DELIVERY: Record<string, { label: string; color: BadgeColor }> = {
  PENDING: { label: "制作待ち", color: "yellow" },
  READY: { label: "納品済", color: "green" },
};

const KUJI: Record<string, { label: string; color: BadgeColor }> = {
  DRAFT: { label: "下書き", color: "gray" },
  OPEN: { label: "販売中", color: "green" },
  CLOSED: { label: "終了", color: "gray" },
};

const MAPS = {
  order: ORDER,
  payment: PAYMENT,
  shipment: SHIPMENT,
  lottery: LOTTERY,
  delivery: DELIVERY,
  kuji: KUJI,
} as const;

export function StatusBadge({
  kind,
  status,
}: {
  kind: keyof typeof MAPS;
  status: string;
}) {
  const conf = MAPS[kind][status] ?? { label: status, color: "gray" as const };
  return <Badge color={conf.color}>{conf.label}</Badge>;
}
