import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { availabilityText, type ShopName } from "@/lib/shop/availability";
import type { ProductCard as Product } from "@/lib/shop/data";
import { photoUrl } from "@/lib/shop/images";

export function ProductCard({
  product,
  shops,
  leadTime,
  currency,
  eager = false,
}: {
  product: Product;
  shops: ShopName[];
  leadTime: string;
  currency: string;
  /** Load the photo straight away (first row of a page). */
  eager?: boolean;
}) {
  const a = product.availability;
  const soldOut = a.max === 0;

  return (
    <Link href={`/p/${product.slug}`} className="group block">
      <div className="bg-surface relative aspect-square overflow-hidden">
        {product.image ? (
          // Plain <img>: photos come from storage or a linked address, at sizes we choose ourselves.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl(product.image, 640)}
            alt=""
            loading={eager ? "eager" : "lazy"}
            className={`shop-photo ${soldOut ? "opacity-60" : ""}`}
          />
        ) : (
          <div className="bg-tint text-muted flex h-full items-center justify-center px-4 text-center font-serif text-lg italic">
            {product.name}
          </div>
        )}
        {product.onSale && !soldOut && (
          <span className="bg-sale absolute top-3 left-3 px-2 py-1 text-[11px] tracking-[0.12em] text-white uppercase">
            Sale
          </span>
        )}
        {soldOut && (
          <span className="bg-surface absolute top-3 left-3 px-2 py-1 text-[11px] tracking-[0.12em] uppercase">
            Sold out
          </span>
        )}
      </div>
      <h3 className="mt-3.5 leading-snug underline-offset-4 group-hover:underline">{product.name}</h3>
      {product.options && <p className="text-muted text-[13px]">{product.options}</p>}
      <p className="mt-1 tabular-nums">
        {product.minPrice !== product.maxPrice ? (
          <>From {formatMoney(product.minPrice, currency)}</>
        ) : product.wasPrice !== null ? (
          <>
            <s className="text-muted mr-2">{formatMoney(product.wasPrice, currency)}</s>
            <span className="text-sale font-medium">{formatMoney(product.minPrice, currency)}</span>
          </>
        ) : (
          formatMoney(product.minPrice, currency)
        )}
      </p>
      <p className="text-muted mt-1.5 flex items-center gap-1.5 text-xs">
        {a.shopIds.length > 0 && <span className="bg-success size-1.5 shrink-0 rounded-full" aria-hidden="true" />}
        {availabilityText(a, shops, leadTime)}
      </p>
    </Link>
  );
}

export function ProductGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">{children}</div>;
}
