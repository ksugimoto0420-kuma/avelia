import { Button } from "@/components/ui/Button";
import { formatYen } from "@/lib/utils";

export function CartSummary({
  subtotal,
  shippingFee = 0,
  actionLabel,
  actionHref,
  onAction,
  disabled,
}: {
  subtotal: number;
  shippingFee?: number;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  const total = subtotal + shippingFee;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-gray-900">ご注文金額</h3>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">小計</dt>
          <dd className="font-medium text-gray-900">{formatYen(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">送料</dt>
          <dd className="font-medium text-gray-900">
            {shippingFee > 0 ? formatYen(shippingFee) : "—"}
          </dd>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-3 text-base">
          <dt className="font-bold text-gray-900">合計</dt>
          <dd className="font-extrabold text-brand-600">{formatYen(total)}</dd>
        </div>
      </dl>
      <div className="mt-5">
        {actionHref ? (
          <Button href={actionHref} fullWidth size="lg" aria-disabled={disabled}>
            {actionLabel}
          </Button>
        ) : (
          <Button onClick={onAction} fullWidth size="lg" disabled={disabled}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
