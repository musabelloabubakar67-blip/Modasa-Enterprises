import type { Metadata } from "next";
import Link from "next/link";
import { ShopClosed } from "@/components/shop/shop-closed";
import { getStorefront } from "@/lib/shop/data";
import { paymentMode } from "@/lib/shop/paystack";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const shop = await getStorefront();
  if (!shop.enabled) return <ShopClosed shop={shop} />;
  const mode = paymentMode();

  return (
    <div className="shop-wrap max-w-[1120px] py-10 md:py-14">
      <Link href="/cart" className="text-muted hover:text-foreground text-sm">
        ← Back to cart
      </Link>
      <h1 className="mt-2 mb-8 font-serif text-[clamp(32px,4vw,48px)] leading-[1.1]">Checkout</h1>
      {mode === "off" ? (
        <p className="bg-tint border-sale border-l-2 px-4 py-3">
          Online payment isn&apos;t set up yet. Please contact us to place your order.
        </p>
      ) : (
        <CheckoutForm
          shops={shop.shops}
          leadTime={shop.leadTime}
          currency={shop.currency}
          openingHours={shop.openingHours}
          testMode={mode === "test"}
        />
      )}
    </div>
  );
}
