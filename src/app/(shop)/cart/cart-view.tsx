"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";
import { availabilityText, type ShopName } from "@/lib/shop/availability";
import { setQuantity, useCart, useCartReady } from "@/lib/shop/cart";
import type { CartLine } from "@/lib/shop/data";
import { photoUrl } from "@/lib/shop/images";
import { loadCart } from "./actions";

export function CartView({ shops, leadTime, currency }: { shops: ShopName[]; leadTime: string; currency: string }) {
  const items = useCart();
  const ready = useCartReady();
  const [details, setDetails] = useState<{ key: string; lines: CartLine[] } | null>(null);

  // Details only depend on which items are in the cart, not how many of each.
  const key = items
    .map((i) => i.skuId)
    .sort()
    .join(",");
  useEffect(() => {
    if (!ready) return;
    let stale = false;
    loadCart(items).then((lines) => {
      if (!stale) setDetails({ key, lines });
    });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  if (!ready || (items.length > 0 && details?.key !== key)) {
    return <p className="text-muted py-16 text-center">Loading your cart…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-serif text-2xl">Your cart is empty</p>
        <Link href="/shop" className="shop-btn mt-7">
          Start shopping
        </Link>
      </div>
    );
  }

  const byId = new Map(details!.lines.map((l) => [l.skuId, l]));
  const rows = items.map((item) => ({ item, line: byId.get(item.skuId) }));
  const subtotal = rows.reduce((sum, { item, line }) => sum + (line ? Math.round(line.price * item.quantity) : 0), 0);
  const blocked = rows.some(({ item, line }) => !line || line.availability.max < item.quantity);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-16">
      <ul className="divide-border border-border divide-y border-y">
        {rows.map(({ item, line }) => {
          if (!line) {
            return (
              <li key={item.skuId} className="flex items-center justify-between gap-4 py-5">
                <p className="text-muted">An item in your cart is no longer sold online.</p>
                <button type="button" className="shop-link text-sm" onClick={() => setQuantity(item.skuId, 0)}>
                  Remove
                </button>
              </li>
            );
          }
          const max = line.availability.max;
          const step = line.allowsDecimal ? 0.5 : 1;
          return (
            <li key={item.skuId} className="flex gap-4 py-5 md:gap-6">
              <Link href={`/p/${line.slug}`} className="bg-surface size-24 shrink-0 overflow-hidden md:size-32">
                {line.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl(line.image, 300)} alt="" className="size-full object-cover" />
                ) : (
                  <span className="bg-tint block size-full" />
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={`/p/${line.slug}`} className="underline-offset-4 hover:underline">
                      {line.name}
                    </Link>
                    {line.label && <p className="text-muted text-[13px]">{line.label}</p>}
                  </div>
                  <p className="shrink-0 tabular-nums">
                    {formatMoney(Math.round(line.price * item.quantity), currency)}
                  </p>
                </div>
                <p className="text-muted mt-1 text-xs">
                  {max === 0
                    ? "Out of stock"
                    : max < item.quantity
                      ? `Only ${max} available`
                      : availabilityText(line.availability, shops, leadTime)}
                </p>
                {max < item.quantity && (
                  <p className="text-sale mt-1 text-xs">
                    {max === 0 ? "Remove this item to continue." : "Reduce the quantity to continue."}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between gap-4 pt-3">
                  <div className="border-border bg-surface flex h-11 items-stretch border">
                    <button
                      type="button"
                      className="w-11 text-lg"
                      aria-label={`Decrease quantity of ${line.name}`}
                      onClick={() => setQuantity(item.skuId, item.quantity - step)}
                    >
                      −
                    </button>
                    <span className="flex w-10 items-center justify-center tabular-nums" aria-live="polite">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="w-11 text-lg disabled:opacity-40"
                      aria-label={`Increase quantity of ${line.name}`}
                      disabled={item.quantity + step > max}
                      onClick={() => setQuantity(item.skuId, item.quantity + step)}
                    >
                      +
                    </button>
                  </div>
                  <button type="button" className="shop-link text-sm" onClick={() => setQuantity(item.skuId, 0)}>
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="bg-tint h-fit p-6 md:p-8">
        <h2 className="font-serif text-2xl">Summary</h2>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(subtotal, currency)}</dd>
          </div>
          <div className="text-muted flex justify-between">
            <dt>Collection or delivery</dt>
            <dd>Chosen at checkout</dd>
          </div>
        </dl>
        {blocked ? (
          <p className="text-sale mt-6 text-sm">Some items need your attention before you can check out.</p>
        ) : (
          <Link href="/checkout" className="shop-btn mt-6 w-full">
            Checkout
          </Link>
        )}
        <Link href="/shop" className="shop-link mt-4 block text-center text-sm">
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}
