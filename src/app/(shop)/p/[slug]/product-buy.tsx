"use client";

import Link from "next/link";
import { useState } from "react";
import { AreaCalculator, RollCalculator } from "@/components/shop/calculators";
import { formatMoney } from "@/lib/money";
import { availabilityText, type ShopName } from "@/lib/shop/availability";
import { addToCart, useCart } from "@/lib/shop/cart";
import type { ProductDetail, ProductSku } from "@/lib/shop/data";
import { photoUrl } from "@/lib/shop/images";
import { useSelectedSku } from "./selection";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** An option button's look: picked, out of stock, or not made in the other choices (still clickable). */
function OptionButton({
  label,
  photo,
  picked,
  out,
  elsewhere,
  onClick,
}: {
  label: string;
  photo?: string;
  picked: boolean;
  out: boolean;
  elsewhere?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={onClick}
      className={`flex min-h-11 items-center gap-2 border text-sm transition-colors ${photo ? "py-1 pr-4 pl-1" : "px-4"} ${
        picked ? "border-foreground font-medium" : "border-border hover:border-foreground"
      } ${elsewhere ? "border-dashed" : ""} ${out ? "text-muted line-through" : ""}`}
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl(photo, 200)} alt="" loading="lazy" className="size-9 object-cover" />
      )}
      {label}
      {out && <span className="sr-only"> (out of stock)</span>}
    </button>
  );
}

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
  const [skuId, setSkuId] = useSelectedSku();
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
  // Picking one option keeps the others if that variant exists; otherwise it moves to one that does.
  const pickOption = (k: number, value: string) => {
    const want = sku.options.map((v, i) => (i === k ? value : v));
    const exact = skus.find((s) => s.options.every((v, i) => same(v, want[i])));
    const withValue = skus.filter((s) => same(s.options[k], value));
    const next = exact ?? withValue.find((s) => s.availability.max > 0) ?? withValue[0];
    if (next) choose(next.id);
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

      {skus.length > 1 && product.optionNames.length > 0
        ? product.optionNames.map((name, k) => {
            const values = skus.reduce<string[]>(
              (list, s) => (list.some((v) => same(v, s.options[k])) ? list : [...list, s.options[k]]),
              [],
            );
            return (
              <fieldset key={name} className="mt-7">
                <legend className="caps text-muted mb-2.5">
                  {name}: <span className="text-foreground">{sku.options[k]}</span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {values.map((value) => {
                    const withValue = skus.filter((s) => same(s.options[k], value));
                    // The variant this button would pick, keeping the other choices as they are.
                    const match = withValue.find((s) => s.options.every((v, i) => i === k || same(v, sku.options[i])));
                    // Photos go on the last option (colour or design), not on sizes, which all look alike.
                    const photo =
                      k === product.optionNames.length - 1
                        ? (match ?? withValue.find((s) => s.images.length))?.images[0]
                        : undefined;
                    return (
                      <OptionButton
                        key={value}
                        label={value}
                        photo={photo}
                        picked={same(value, sku.options[k])}
                        out={(match ? [match] : withValue).every((s: ProductSku) => s.availability.max === 0)}
                        elsewhere={!match}
                        onClick={() => pickOption(k, value)}
                      />
                    );
                  })}
                </div>
              </fieldset>
            );
          })
        : skus.length > 1 && (
            <fieldset className="mt-7">
              <legend className="caps text-muted mb-2.5">
                Option: <span className="text-foreground">{sku.label ?? sku.code}</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {skus.map((s) => (
                  <OptionButton
                    key={s.id}
                    label={s.label ?? s.code}
                    photo={s.images[0]}
                    picked={s.id === sku.id}
                    out={s.availability.max === 0}
                    onClick={() => choose(s.id)}
                  />
                ))}
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
