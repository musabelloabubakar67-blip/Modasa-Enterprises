"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { formatMoney } from "@/lib/money";
import { rememberPendingOrder, settlePendingOrder, useCart, useCartReady } from "@/lib/shop/cart";
import type { Shop } from "@/lib/shop/data";
import { bestShopForDelivery, type ShopPlan } from "@/lib/shop/plan";
import { loadCheckout, releaseOrder, type CheckoutData } from "../cart/actions";
import { placeOrder } from "./actions";

type Fulfilment = "collect_later" | "delivery";

function shopStatus(plan: ShopPlan | undefined, leadTime: string) {
  if (!plan || !plan.ok) return "Not everything is available here";
  return plan.ready ? "Ready to collect today" : `Ready in ${leadTime}`;
}

export function CheckoutForm({
  shops,
  leadTime,
  currency,
  openingHours,
  testMode,
}: {
  shops: Shop[];
  leadTime: string;
  currency: string;
  openingHours: string | null;
  testMode: boolean;
}) {
  const items = useCart();
  const ready = useCartReady();
  const [data, setData] = useState<CheckoutData | null>(null);
  const [version, setVersion] = useState(0);
  const [fulfilment, setFulfilment] = useState<Fulfilment>("collect_later");
  const [shopId, setShopId] = useState<string | null>(null);
  const [areaId, setAreaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const key = JSON.stringify(items);
  useEffect(() => {
    if (!ready) return;
    let stale = false;
    // Back here without paying: let go of the order they started, then look at stock afresh.
    settlePendingOrder(releaseOrder)
      .then(() => loadCheckout(items))
      .then((result) => {
        if (!stale) setData(result);
      });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, version]);

  if (!ready || !data) return <p className="text-muted py-16 text-center">Loading…</p>;

  if (items.length === 0 || data.lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-serif text-2xl">Your cart is empty</p>
        <Link href="/shop" className="shop-btn mt-7">
          Start shopping
        </Link>
      </div>
    );
  }

  const { lines, plans, areas } = data;
  const planFor = (id: string) => plans.find((p) => p.shopId === id);
  const pickupShop =
    shopId && planFor(shopId)?.ok
      ? shopId
      : (plans.find((p) => p.ready)?.shopId ?? plans.find((p) => p.ok)?.shopId ?? null);
  const deliveryPlan = bestShopForDelivery(plans);
  const possible = plans.some((p) => p.ok);
  const activePlan = fulfilment === "delivery" ? deliveryPlan : pickupShop ? planFor(pickupShop) : undefined;

  const subtotal = lines.reduce((sum, l) => sum + Math.round(l.price * l.quantity), 0);
  const area = areas.find((a) => a.id === areaId);
  const fee = fulfilment === "delivery" ? (area?.fee ?? null) : 0;
  const stale = lines.length !== items.length || lines.some((l) => l.availability.max < l.quantity);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await placeOrder({
        items,
        fulfilment,
        shopId: fulfilment === "collect_later" ? (pickupShop ?? undefined) : undefined,
        name: text("name"),
        phone: text("phone"),
        email: text("email"),
        address: text("address") || undefined,
        areaId: areaId || undefined,
        note: text("note") || undefined,
        website: text("website"),
      });
      if (result.ok) {
        // The cart is emptied once the payment is confirmed, on the order page.
        rememberPendingOrder(result.token);
        window.location.assign(result.paymentUrl);
        return;
      }
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      if (result.refresh) setVersion((n) => n + 1);
    });
  };

  const field = (name: string) => ({
    id: name,
    name,
    className: "shop-input",
    "aria-invalid": fieldErrors[name] ? true : undefined,
    "aria-describedby": fieldErrors[name] ? `${name}-error` : undefined,
  });
  const problem = (name: string) =>
    fieldErrors[name] && (
      <p id={`${name}-error`} className="text-sale mt-1 text-xs">
        {fieldErrors[name]}
      </p>
    );
  const option = (active: boolean, disabled = false) =>
    `flex min-h-14 cursor-pointer items-start gap-3 border p-4 transition-colors ${
      active ? "border-foreground bg-surface" : "border-border hover:border-foreground"
    } ${disabled ? "cursor-not-allowed opacity-55" : ""}`;

  return (
    <form onSubmit={submit} method="post" className="grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-16" noValidate>
      <div className="space-y-10">
        <section>
          <h2 className="font-serif text-2xl">1. How would you like to get it?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={option(fulfilment === "collect_later")}>
              <input
                type="radio"
                name="fulfilment"
                className="mt-1"
                checked={fulfilment === "collect_later"}
                onChange={() => setFulfilment("collect_later")}
              />
              <span>
                <span className="font-medium">Collect in store</span>
                <span className="text-muted block text-sm">Free</span>
              </span>
            </label>
            <label className={option(fulfilment === "delivery", areas.length === 0)}>
              <input
                type="radio"
                name="fulfilment"
                className="mt-1"
                disabled={areas.length === 0}
                checked={fulfilment === "delivery"}
                onChange={() => setFulfilment("delivery")}
              />
              <span>
                <span className="font-medium">Delivery</span>
                <span className="text-muted block text-sm">
                  {areas.length === 0
                    ? "Not available at the moment"
                    : `From ${formatMoney(Math.min(...areas.map((a) => a.fee)), currency)}`}
                </span>
              </span>
            </label>
          </div>

          {fulfilment === "collect_later" ? (
            <fieldset className="mt-6">
              <legend className="caps text-muted mb-2.5">Collect from</legend>
              <div className="grid gap-3">
                {shops.map((s) => {
                  const plan = planFor(s.id);
                  return (
                    <label key={s.id} className={option(pickupShop === s.id, !plan?.ok)}>
                      <input
                        type="radio"
                        name="shop"
                        className="mt-1"
                        disabled={!plan?.ok}
                        checked={pickupShop === s.id}
                        onChange={() => setShopId(s.id)}
                      />
                      <span className="min-w-0">
                        <span className="font-medium">{s.name}</span>
                        <span className={`ml-2 text-sm ${plan?.ok && plan.ready ? "text-success" : "text-muted"}`}>
                          {shopStatus(plan, leadTime)}
                        </span>
                        {s.address && <span className="text-muted block text-sm">{s.address}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
              {problem("shopId")}
              {openingHours && <p className="text-muted mt-3 text-sm">Open {openingHours}.</p>}
            </fieldset>
          ) : (
            <div className="mt-6 grid gap-4">
              <div>
                <label htmlFor="areaId" className="mb-1 block text-sm font-medium">
                  Delivery area
                </label>
                <select {...field("areaId")} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                  <option value="">Choose your area…</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {formatMoney(a.fee, currency)}
                    </option>
                  ))}
                </select>
                {problem("areaId")}
              </div>
              <div>
                <label htmlFor="address" className="mb-1 block text-sm font-medium">
                  Delivery address
                </label>
                <textarea {...field("address")} rows={3} autoComplete="street-address" />
                {problem("address")}
              </div>
              {deliveryPlan && (
                <p className="text-muted text-sm">
                  {deliveryPlan.ready
                    ? "Everything is in stock. We will call you to agree a delivery time."
                    : `Some items come from our warehouse first, so allow ${leadTime} before delivery. We will call you to agree a time.`}
                </p>
              )}
            </div>
          )}

          {!possible && (
            <p role="alert" className="bg-tint border-sale mt-5 border-l-2 px-4 py-3 text-sm">
              The items in your cart are at different shops, so they can&apos;t go in one order. Please order them
              separately, or message us and we will arrange it for you.
            </p>
          )}
        </section>

        <section>
          <h2 className="font-serif text-2xl">2. Your details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="name" className="mb-1 block text-sm font-medium">
                Full name
              </label>
              <input {...field("name")} autoComplete="name" required />
              {problem("name")}
            </div>
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium">
                Phone number
              </label>
              <input {...field("phone")} type="tel" inputMode="tel" autoComplete="tel" required />
              {problem("phone") || <p className="text-muted mt-1 text-xs">We call or WhatsApp you about this order.</p>}
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
                Email
              </label>
              <input {...field("email")} type="email" autoComplete="email" required />
              {problem("email") || <p className="text-muted mt-1 text-xs">For your payment receipt.</p>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="note" className="mb-1 block text-sm font-medium">
                Note <span className="text-muted font-normal">(optional)</span>
              </label>
              <textarea {...field("note")} rows={2} />
            </div>
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
          </div>
        </section>
      </div>

      <aside className="bg-tint h-fit p-6 md:p-8 lg:sticky lg:top-36">
        <h2 className="font-serif text-2xl">Your order</h2>
        <ul className="divide-border mt-4 divide-y text-sm">
          {lines.map((l) => (
            <li key={l.skuId} className="flex justify-between gap-4 py-3">
              <span className="min-w-0">
                {l.quantity} × {l.name}
                {l.label && <span className="text-muted"> · {l.label}</span>}
                {activePlan?.lines[l.skuId] === "transfer" && (
                  <span className="text-muted block text-xs">Comes from our warehouse · {leadTime}</span>
                )}
                {activePlan?.lines[l.skuId] === "unavailable" && (
                  <span className="text-sale block text-xs">Not available</span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">{formatMoney(Math.round(l.price * l.quantity), currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="border-border space-y-2 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(subtotal, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{fulfilment === "delivery" ? "Delivery" : "Collection"}</dt>
            <dd className="tabular-nums">
              {fee === null ? "Choose an area" : fee === 0 ? "Free" : formatMoney(fee, currency)}
            </dd>
          </div>
          <div className="border-border flex justify-between border-t pt-3 text-base font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(subtotal + (fee ?? 0), currency)}</dd>
          </div>
        </dl>

        {error && (
          <p role="alert" className="bg-surface border-sale mt-5 border-l-2 px-4 py-3 text-sm">
            {error}
          </p>
        )}
        {stale && (
          <p role="alert" className="bg-surface border-sale mt-5 border-l-2 px-4 py-3 text-sm">
            Availability has changed.{" "}
            <Link href="/cart" className="shop-link">
              Review your cart
            </Link>
          </p>
        )}
        <button type="submit" className="shop-btn mt-6 w-full" disabled={pending || stale || !activePlan?.ok}>
          {pending ? "One moment…" : "Pay securely"}
        </button>
        <p className="text-muted mt-3 text-center text-xs">
          {testMode
            ? "Test mode: no real payment is taken."
            : "Card, bank transfer or USSD, handled by Paystack. We hold your items while you pay."}
        </p>
      </aside>
    </form>
  );
}
