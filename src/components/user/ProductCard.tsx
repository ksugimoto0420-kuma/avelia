import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { MediaImage } from "@/components/ui/MediaImage";
import {
  getSaleStatus,
  SALE_STATUS_COLOR,
  SALE_STATUS_LABEL,
  type SaleWindowInput,
} from "@/lib/sale";
import { formatDateTime, formatYen } from "@/lib/utils";

export type ProductCardData = {
  id: string;
  name: string;
  imageUrl: string | null;
  basePrice: number;
  type: "PHYSICAL" | "DIGITAL";
  benefit: string | null;
  deliveryDate: Date | string | null;
  sale: SaleWindowInput;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const status = getSaleStatus(product.sale);

  return (
    <Link
      href={`/products/${product.id}`}
      className="group block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative">
        <MediaImage
          src={product.imageUrl}
          alt={product.name}
          aspect="1/1"
          fallback="🎤"
        />
        <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1">
          <Badge color={SALE_STATUS_COLOR[status]}>
            {SALE_STATUS_LABEL[status]}
          </Badge>
          {product.type === "DIGITAL" && <Badge color="purple">デジタル</Badge>}
        </div>
      </div>
      <div className="p-3">
        {product.benefit && (
          <p className="mb-1 line-clamp-1 text-xs font-semibold text-brand-600">
            ✦ {product.benefit}
          </p>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-brand-600">
          {product.name}
        </h3>
        <p className="mt-1 font-bold text-gray-900">
          {formatYen(product.basePrice)}
        </p>
        {product.deliveryDate && (
          <p className="mt-1 text-xs text-gray-400">
            配信予定: {formatDateTime(product.deliveryDate)}
          </p>
        )}
      </div>
    </Link>
  );
}
