"use client";

import Link from "next/link";
import { useState } from "react";
import { AreaCalculator, RollCalculator } from "@/components/shop/calculators";
import { formatMoney } from "@/lib/money";
import { availabilityText, type ShopName } from "@/lib/shop/availability";
import { addToCart, useCart } from "@/lib/shop/cart";
import type { ProductDetail } from "@/lib/shop/data";

export function ProductBuy({
  product,
  shops,
  leadTime,
  currency,
}: {
  product: ProductDetail;
  shops: ShopName[];
  leadTime: string;
  currency: string;
}) {
  const { skus, unit } = product;
  const [skuId, setSkuId] = useState((skus.find((s) => s.availability.max > 0) ?? skus[0]).id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState<string | null>(null);
  // Set when the calculator asks for more than can be ordered online.
  const [short, setShort] = useState(false);
  const cart = useCart();

  const sku = skus.find((s) => s.id === skuId)!;
  const a = sku.availability;
  const inCart = cart.find((i) => i.skuId === sku.id)?.quantity ?? 0;
  const room = Math.max(0, a.max - inCart);
  const step = unit.allowsDecimal ? 0.5 : 1;
  const clamp = (n: number) => Math.max(step, Math.min(room || step, Math.round(n / step) * step));

  const choose = (id: string) => {
    setSkuId(id);
    setQuantity(1);
    setAdded(null);
    setShort(false);
  };
  const applyCalculated = (n: number) => {
    setShort(n > room);
    setQuantity(clamp(n));
  };

  const add = () => {
    addToCart(sku.id, quantity, a.max);
    setAdded(`${quantity} × ${product.name}${sku.label ? ` (${sku.label})` : ""}`);
    setQuantity(1);
  };

  const calculator =
    unit.coverage === "roll" && sku.rollWidthCm && sku.rollLengthCm ? (
      <RollCalculator
        key={sku.id}
        rollWidthCm={sku.rollWidthCm}
        rollLengthCm={sku.rollLengthCm}
        fixedRoll
        onUse={applyCalculated}
      />
    ) : unit.coverage === "area" && sku.coverageM2 ? (
      <AreaCalculator key={sku.id} coverageM2={sku.coverageM2} fixedCoverage onUse={applyCalculated} />
    ) : null;

  return (
    <div>
      <p className="text-xl tabular-nums">
        {sku.price < sku.listPrice ? (
          <>
            <s className="text-muted mr-2.5 text-base">{formatMoney(sku.listPrice, currency)}</s>
            <span className="text-sale font-medium">{formatMoney(sku.price, currency)}</span>
          </>
        ) : (
          formatMoney(sku.price, currency)
        )}
        <span className="text-muted ml-2 text-sm">per {unit.name.toLowerCase()}</span>
      </p>

      {skus.length > 1 && (
        <fieldset className="mt-7">
          <legend className="caps text-muted mb-2.5">
            Option: <span className="text-foreground">{sku.label ?? sku.code}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {skus.map((s) => {
              const out = s.availability.max === 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === sku.id}
                  onClick={() => choose(s.id)}
                  className={`min-h-11 border px-4 text-sm transition-colors ${
                    s.id === sku.id ? "border-foreground font-medium" : "border-border hover:border-foreground"
                  } ${out ? "text-muted line-through" : ""}`}
                >
                  {s.label ?? s.code}
                  {out && <span className="sr-only"> (out of stock)</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <p className="mt-6 flex items-start gap-2 text-sm">
        {a.shopIds.length > 0 && <span className="bg-success mt-2 size-1.5 shrink-0 rounded-full" aria-hidden="true" />}
        <span>
          {availabilityText(a, shops, leadTime)}
          {a.toOrder && (
            <span className="text-muted block">We bring it to the shop you choose, or deliver it to you.</span>
          )}
        </span>
      </p>

      {a.max > 0 && (
        <div className="mt-6 flex flex-wrap items-stretch gap-3">
          <div className="border-border bg-surface flex h-12 items-stretch border">
            <button
              type="button"
              className="w-11 text-lg disabled:opacity-40"
              aria-label="Decrease quantity"
              disabled={quantity <= step}
              onClick={() => setQuantity(clamp(quantity - step))}
            >
              −
            </button>
            <input
              aria-label="Quantity"
              className="w-12 [appearance:textfield] bg-transparent text-center tabular-nums outline-none"
              inputMode={unit.allowsDecimal ? "decimal" : "numeric"}
              value={quantity}
              onChange={(e) => setQuantity(clamp(Number(e.target.value) || step))}
            />
            <button
              type="button"
              className="w-11 text-lg disabled:opacity-40"
              aria-label="Increase quantity"
              disabled={quantity >= room}
              onClick={() => setQuantity(clamp(quantity + step))}
            >
              +
            </button>
          </div>
          <button type="button" className="shop-btn min-w-48 flex-1" disabled={room === 0} onClick={add}>
            {room === 0 ? "All available are in your cart" : "Add to cart"}
          </button>
        </div>
      )}

      {short && (
        <p role="status" className="text-muted mt-3 text-sm">
          Only {room} can be ordered online right now. Message us if you need more and we will arrange it.
        </p>
      )}

      {added && (
        <p
          role="status"
          className="bg-tint border-success mt-4 flex flex-wrap items-center justify-between gap-2 border-l-2 px-4 py-3 text-sm"
        >
          <span>Added: {added}</span>
          <Link href="/cart" className="shop-link">
            View cart
          </Link>
        </p>
      )}

      {calculator && (
        <details className="border-border mt-8 border-y py-4">
          <summary className="caps flex min-h-9 cursor-pointer list-none items-center justify-between">
            {unit.coverage === "roll" ? "How many rolls do I need?" : "How many boxes do I need?"}
            <span aria-hidden="true">+</span>
          </summary>
          <div className="pt-4">{calculator}</div>
        </details>
      )}
    </div>
  );
}
