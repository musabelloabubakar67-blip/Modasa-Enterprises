import Link from "next/link";
import type { Storefront } from "@/lib/shop/data";

/** Shown in place of the shop when the owner has switched online ordering off. */
export function ShopClosed({ shop }: { shop: Storefront }) {
  return (
    <div className="shop-wrap py-24 text-center">
      <h1 className="font-serif text-4xl">Our online shop is closed for now</h1>
      <p className="text-muted mx-auto mt-4 max-w-md">
        You are welcome to visit {shop.businessName} in person
        {shop.openingHours ? `, ${shop.openingHours}` : ""}.
      </p>
      <Link href="/our-shops" className="shop-btn mt-8">
        Find a shop
      </Link>
    </div>
  );
}
