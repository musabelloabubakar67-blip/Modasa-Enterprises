import type { Metadata } from "next";
import { ShopClosed } from "@/components/shop/shop-closed";
import { getStorefront } from "@/lib/shop/data";
import { CartView } from "./cart-view";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default async function CartPage() {
  const shop = await getStorefront();
  if (!shop.enabled) return <ShopClosed shop={shop} />;
  return (
    <div className="shop-wrap py-10 md:py-14">
      <h1 className="mb-8 font-serif text-[clamp(32px,4vw,48px)] leading-[1.1]">Your cart</h1>
      <CartView
        shops={shop.shops.map((s) => ({ id: s.id, name: s.name }))}
        leadTime={shop.leadTime}
        currency={shop.currency}
      />
    </div>
  );
}
