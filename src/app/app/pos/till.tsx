"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { SkuPicker, skuLabel } from "@/components/sku-picker";
import { formatMoney, parseMoney, toMoneyInput } from "@/lib/money";
import { formatQty } from "@/lib/quantity";
import { ProductThumb } from "@/components/product-thumb";
import { clearExchange, loadExchange, type ExchangeDraft } from "@/lib/exchange";
import { completeExchange, completeSale, lookupCustomer, tillItemInfo, type TillItem } from "./actions";
import { Calculator } from "./calculator";
import { SaleComplete } from "./sale-complete";

type Line = { key: string; item: TillItem; batch: string; quantity: string };
type Fulfilment = "taken" | "collect_later" | "delivery";
type Payment = { method: "cash" | "card" | "transfer"; amount: string; tendered: string; reference: string };

type Discount = { type: "percent" | "amount"; value: string; reason: string };

type Draft = {
  lines: Line[];
  /** One discount on the items, within the seller's limit. Not allowed on an exchange. */
  discount: Discount | null;
  customer: { name: string; phone: string; email: string };
  fulfilment: Fulfilment;
  delivery: { address: string; area: string; date: string; fee: string };
  note: string;
};

const EMPTY: Draft = {
  lines: [],
  discount: null,
  customer: { name: "", phone: "", email: "" },
  fulfilment: "taken",
  delivery: { address: "", area: "", date: "", fee: "" },
  note: "",
};

const METHOD_LABELS = { cash: "Cash", card: "POS card", transfer: "Bank transfer" } as const;

const unitPrice = (item: TillItem) => item.promo_price_kobo ?? item.price_kobo;
const lineTotal = (l: Line) => Math.round(unitPrice(l.item) * (Number(l.quantity) || 0));

// The cart survives a page refresh (browser storage), so a sale in progress is never lost.
function loadDraft(key: string): Draft {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function Till({
  shop,
  currency,
  discountLimit,
}: {
  shop: { id: string; name: string };
  currency: string;
  /** The largest discount this person may give, as a percentage (100 for the owner). */
  discountLimit: number;
}) {
  const storageKey = `till-draft:${shop.id}`;
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState<TillItem | null>(null);
  const [calculatorFor, setCalculatorFor] = useState<string | null>(null);
  const [stage, setStage] = useState<"cart" | "pay">("cart");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string | null>(null);
  // An exchange chosen on a sale's Exchange items page: its credit pays towards this sale.
  const [exchange, setExchange] = useState<ExchangeDraft | null>(null);
  const [pending, startTransition] = useTransition();
  const lookedUp = useRef("");

  useEffect(() => {
    // Restore after mount: browser storage isn't available during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(loadDraft(storageKey));
    setExchange(loadExchange(shop.id));
    setLoaded(true);
  }, [storageKey, shop.id]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // Storage full or blocked: the till still works, the draft just won't survive a refresh.
    }
  }, [draft, loaded, storageKey]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setLine = (key: string, patch: Partial<Line>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  const subtotal = draft.lines.reduce((s, l) => s + lineTotal(l), 0);
  const fee = draft.fulfilment === "delivery" ? (parseMoney(draft.delivery.fee) ?? 0) : 0;
  const credit = exchange?.credit_kobo ?? 0;
  // Discount: a percentage or an amount on the items. NaN while what's typed isn't a number.
  const discount = !exchange && draft.discount ? draft.discount : null;
  const discountKobo = !discount
    ? 0
    : discount.type === "percent"
      ? Math.round((subtotal * Number(discount.value)) / 100)
      : (parseMoney(discount.value) ?? NaN);
  const discountPct = subtotal > 0 && discountKobo > 0 ? (discountKobo / subtotal) * 100 : 0;
  const total = subtotal - (Number.isNaN(discountKobo) ? 0 : discountKobo) + (Number.isNaN(fee) ? 0 : fee);

  function cancelExchange() {
    if (!confirm("Cancel this exchange? The items stay with the customer and nothing is recorded.")) return;
    clearExchange(shop.id);
    setExchange(null);
    setStage("cart");
  }

  // Quantity in the cart per SKU+batch, to warn when it exceeds what the shop has.
  const inCart = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of draft.lines) {
      const k = `${l.item.id}|${l.batch}`;
      m.set(k, (m.get(k) ?? 0) + (Number(l.quantity) || 0));
    }
    return m;
  }, [draft.lines]);

  async function pick(sku: { id: string }) {
    setError(null);
    const item = await tillItemInfo(sku.id, shop.id);
    if (!item) return;
    const here = item.batches.reduce((s, b) => s + b.quantity, 0);
    if (here <= 0) {
      setUnavailable(item);
      return;
    }
    setUnavailable(null);
    setDraft((d) => {
      // Scanning an item again adds one more, unless it's batch-tracked (then the cashier picks).
      const existing = d.lines.find((l) => l.item.id === item.id);
      if (existing && !item.track_batches) {
        return {
          ...d,
          lines: d.lines.map((l) =>
            l.key === existing.key ? { ...l, quantity: formatQty((Number(l.quantity) || 0) + 1) } : l,
          ),
        };
      }
      return {
        ...d,
        lines: [...d.lines, { key: crypto.randomUUID(), item, batch: item.batches[0]?.batch ?? "", quantity: "1" }],
      };
    });
  }

  function startPayment() {
    setError(null);
    const problem = validateCart();
    if (problem) return setError(problem);
    // Store policy: an exchange is for items of equal or higher value; the customer tops up the difference.
    if (exchange && subtotal < credit)
      return setError(
        `The replacement must come to at least ${formatMoney(credit, currency)} (the returned items). Add items, or choose dearer ones.`,
      );
    const due = total - credit;
    setPayments(due > 0 ? [{ method: "cash", amount: toMoneyInput(due), tendered: "", reference: "" }] : []);
    setStage("pay");
  }

  function validateCart(): string | null {
    if (draft.lines.length === 0) return "The cart is empty.";
    for (const l of draft.lines) {
      const q = Number(l.quantity);
      if (!(q > 0)) return `Enter a quantity for ${skuLabel(l.item)}.`;
      if (!l.item.allows_decimal && !Number.isInteger(q)) return `${skuLabel(l.item)} is sold in whole ${l.item.unit}.`;
      const available = l.item.batches.find((b) => b.batch === l.batch)?.quantity ?? 0;
      if ((inCart.get(`${l.item.id}|${l.batch}`) ?? 0) > available)
        return `Only ${formatQty(available)} ${l.item.unit} of ${skuLabel(l.item)}${l.batch ? ` (batch ${l.batch})` : ""} in this shop.`;
    }
    if (
      draft.fulfilment !== "taken" &&
      (!draft.customer.name.trim() || draft.customer.phone.replace(/\D/g, "").length < 7)
    )
      return "Enter the customer's name and phone number for collection or delivery.";
    if (draft.fulfilment === "delivery" && !draft.delivery.address.trim()) return "Enter the delivery address.";
    if (Number.isNaN(fee)) return "Check the delivery fee.";
    if (discount) {
      if (!(discountKobo > 0) || discountKobo > subtotal) return "Check the discount.";
      if (discountPct > discountLimit + 1e-9)
        return `That discount is ${formatQty(Math.round(discountPct * 10) / 10)}%. Your limit is ${formatQty(discountLimit)}%.`;
      if (!discount.reason.trim()) return "Give a reason for the discount.";
    }
    return null;
  }

  const paid = credit + payments.reduce((s, p) => s + (parseMoney(p.amount) || 0), 0);
  const remaining = total - paid;

  function complete() {
    setError(null);
    for (const p of payments) {
      const amount = parseMoney(p.amount);
      if (amount === null || Number.isNaN(amount) || amount <= 0) return setError("Check the payment amounts.");
      if (p.method === "cash" && p.tendered) {
        const tendered = parseMoney(p.tendered);
        if (tendered === null || Number.isNaN(tendered) || tendered < amount)
          return setError("Cash received must be at least the cash amount.");
      }
    }
    if (remaining !== 0)
      return setError(
        remaining > 0
          ? `${formatMoney(remaining, currency)} still to pay.`
          : `Payments are ${formatMoney(-remaining, currency)} more than the total.`,
      );

    startTransition(async () => {
      const sale = {
        location_id: shop.id,
        note: draft.note || undefined,
        customer: draft.customer.name.trim()
          ? {
              name: draft.customer.name,
              phone: draft.customer.phone || undefined,
              email: draft.customer.email || undefined,
              address: draft.fulfilment === "delivery" ? draft.delivery.address : undefined,
            }
          : undefined,
        lines: draft.lines.map((l) => ({ sku_id: l.item.id, batch: l.batch, quantity: Number(l.quantity) })),
        payments: payments.map((p) => ({
          method: p.method,
          amount_kobo: parseMoney(p.amount)!,
          tendered_kobo: p.method === "cash" && p.tendered ? parseMoney(p.tendered)! : undefined,
          reference: p.reference || undefined,
        })),
        fulfilment: draft.fulfilment,
        discount: discount
          ? {
              type: discount.type,
              value: discount.type === "percent" ? Number(discount.value) : discountKobo,
              reason: discount.reason.trim(),
            }
          : undefined,
        delivery:
          draft.fulfilment === "delivery"
            ? {
                address: draft.delivery.address,
                area: draft.delivery.area || undefined,
                date: draft.delivery.date || undefined,
                fee_kobo: fee,
              }
            : undefined,
      };
      const result = exchange
        ? await completeExchange({
            return: {
              sale_id: exchange.sale_id,
              reason: exchange.reason,
              lines: exchange.lines.map((l) => ({
                sale_line_id: l.sale_line_id,
                quantity: l.quantity,
                condition: l.condition,
              })),
            },
            sale,
          })
        : await completeSale(sale);
      if (result.error) return setError(result.error);
      if (exchange) {
        clearExchange(shop.id);
        setExchange(null);
      }
      setCompleted(result.saleId!);
      setDraft(EMPTY);
      setStage("cart");
    });
  }

  if (completed) {
    return <SaleComplete saleId={completed} currency={currency} onNewSale={() => setCompleted(null)} />;
  }

  const calcLine = draft.lines.find((l) => l.key === calculatorFor);
  const mixed = new Set(
    draft.lines
      .filter((l) => l.item.track_batches)
      .filter((l, _, all) => all.some((o) => o.item.id === l.item.id && o.batch !== l.batch))
      .map((l) => l.item.id),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Cart */}
      <section className="space-y-3">
        {exchange && (
          <div className="card border-accent/40 bg-accent/5 space-y-1 p-4 text-sm" role="status">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                Exchange for {exchange.sale_number}: credit {formatMoney(credit, currency)}
              </p>
              <button type="button" className="text-muted text-xs hover:underline" onClick={cancelExchange}>
                Cancel exchange
              </button>
            </div>
            <p className="text-muted">
              Coming back: {exchange.lines.map((l) => `${formatQty(l.quantity)} × ${l.label}`).join(", ")}. Add the
              replacement items: they must come to at least {formatMoney(credit, currency)}, and the customer pays any
              difference.
            </p>
          </div>
        )}
        {stage === "cart" && <SkuPicker onPick={pick} autoFocus captureScans />}

        {unavailable && (
          <div className="card space-y-2 border-amber-400 p-4 text-sm" role="status">
            <p>
              <strong>{skuLabel(unavailable)}</strong> is not in stock at {shop.name}
              {unavailable.inTransitHere > 0 && ` (${formatQty(unavailable.inTransitHere)} on the way)`}.
            </p>
            {unavailable.elsewhere.length > 0 ? (
              <>
                <ul className="text-muted">
                  {unavailable.elsewhere.map((e) => (
                    <li key={e.location_id}>
                      {e.name}: {formatQty(e.quantity)} {unavailable.unit}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/app/transfers/new?to=${shop.id}&sku=${unavailable.id}&qty=1${
                    unavailable.elsewhere[0]?.kind === "warehouse"
                      ? `&from=${unavailable.elsewhere[0].location_id}`
                      : ""
                  }`}
                  className="btn btn-secondary"
                >
                  Request it for this shop
                </Link>
              </>
            ) : (
              <p className="text-muted">None anywhere.</p>
            )}
            <button
              type="button"
              className="text-muted block text-xs hover:underline"
              onClick={() => setUnavailable(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {draft.lines.length === 0 ? (
          <p className="card text-muted p-8 text-center text-sm">Scan a barcode or search to add items.</p>
        ) : (
          <ul className="card divide-border divide-y">
            {draft.lines.map((l) => {
              const available = l.item.batches.find((b) => b.batch === l.batch)?.quantity ?? 0;
              const over = (inCart.get(`${l.item.id}|${l.batch}`) ?? 0) > available;
              const promo = l.item.promo_price_kobo !== null;
              return (
                <li key={l.key} className="space-y-2 p-3">
                  <div className="flex items-start gap-3">
                    {/* Confirms at a glance that the scanned or picked item is the one on the counter. Lines
                        saved before photos were added have no image and show initials. */}
                    <ProductThumb path={l.item.image} name={l.item.product_name} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{skuLabel(l.item)}</p>
                      <p className="text-muted text-xs">
                        <span className="font-mono">{l.item.code}</span> ·{" "}
                        {promo && <span className="mr-1 line-through">{formatMoney(l.item.price_kobo, currency)}</span>}
                        <span className={promo ? "text-success font-medium" : ""}>
                          {formatMoney(unitPrice(l.item), currency)}
                        </span>{" "}
                        / {l.item.unit}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">{formatMoney(lineTotal(l), currency)}</p>
                  </div>
                  {stage === "cart" && (
                    <div className="flex flex-wrap items-end gap-2">
                      {l.item.track_batches && (
                        <label className="w-40">
                          <span className="label text-xs">Batch</span>
                          <select
                            className="input"
                            value={l.batch}
                            onChange={(e) => setLine(l.key, { batch: e.target.value })}
                          >
                            {l.item.batches.map((b) => (
                              <option key={b.batch} value={b.batch}>
                                {b.batch || "No batch"} ({formatQty(b.quantity)})
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="flex items-end">
                        <button
                          type="button"
                          className="btn btn-secondary rounded-r-none px-3"
                          aria-label="One less"
                          onClick={() =>
                            setLine(l.key, { quantity: formatQty(Math.max(1, (Number(l.quantity) || 1) - 1)) })
                          }
                        >
                          −
                        </button>
                        <label>
                          <span className="sr-only">Quantity</span>
                          <input
                            className="input w-20 rounded-none text-center tabular-nums"
                            inputMode={l.item.allows_decimal ? "decimal" : "numeric"}
                            value={l.quantity}
                            onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-secondary rounded-l-none px-3"
                          aria-label="One more"
                          onClick={() => setLine(l.key, { quantity: formatQty((Number(l.quantity) || 0) + 1) })}
                        >
                          +
                        </button>
                      </div>
                      {l.item.coverage !== "none" && (
                        <button type="button" className="btn btn-secondary" onClick={() => setCalculatorFor(l.key)}>
                          {l.item.coverage === "roll" ? "Rolls calculator" : "Area calculator"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-danger ml-auto px-2 py-2 text-sm hover:underline"
                        onClick={() => set({ lines: draft.lines.filter((x) => x.key !== l.key) })}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {over && (
                    <p className="text-danger text-xs">
                      Only {formatQty(available)} {l.item.unit} {l.batch ? `in batch ${l.batch}` : ""} here.
                      {l.item.track_batches &&
                        l.item.batches.length > 1 &&
                        " Choose another batch or reduce the quantity."}
                    </p>
                  )}
                  {mixed.has(l.item.id) && (
                    <p className="text-xs text-amber-700">
                      Mixing batches of this item — shades may differ slightly on the wall. Tell the customer.
                    </p>
                  )}
                  {stage === "cart" && l.item.track_batches && (
                    <button
                      type="button"
                      className="text-accent text-xs hover:underline"
                      onClick={() =>
                        set({
                          lines: [
                            ...draft.lines,
                            {
                              key: crypto.randomUUID(),
                              item: l.item,
                              batch: l.item.batches.find((b) => b.batch !== l.batch)?.batch ?? l.batch,
                              quantity: "1",
                            },
                          ],
                        })
                      }
                    >
                      + Add from another batch
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Checkout */}
      <aside className="space-y-3">
        {error && (
          <p role="alert" className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
            {error}
          </p>
        )}

        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Customer</h2>
          <input
            className="input"
            placeholder="Phone number"
            inputMode="tel"
            value={draft.customer.phone}
            disabled={stage === "pay"}
            onChange={(e) => set({ customer: { ...draft.customer, phone: e.target.value } })}
            onBlur={async () => {
              // Returning customer: fill in their name from the last visit.
              const phone = draft.customer.phone.replace(/\D/g, "");
              if (phone.length < 7 || phone === lookedUp.current) return;
              lookedUp.current = phone;
              const found = await lookupCustomer(phone);
              if (found) {
                setDraft((d) => ({
                  ...d,
                  customer: {
                    ...d.customer,
                    name: d.customer.name || found.name,
                    email: d.customer.email || found.email || "",
                  },
                  delivery: { ...d.delivery, address: d.delivery.address || found.address || "" },
                }));
              }
            }}
            aria-label="Customer phone"
          />
          <input
            className="input"
            placeholder="Name"
            value={draft.customer.name}
            disabled={stage === "pay"}
            onChange={(e) => set({ customer: { ...draft.customer, name: e.target.value } })}
            aria-label="Customer name"
          />
          <p className="text-muted text-xs">Optional for walk-in sales. Needed for collection or delivery.</p>
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Handover</h2>
          <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Handover">
            {(
              [
                ["taken", "Takes now"],
                ["collect_later", "Collects later"],
                ["delivery", "Delivery"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={draft.fulfilment === value}
                disabled={stage === "pay"}
                onClick={() => set({ fulfilment: value })}
                className={`rounded-md border px-2 py-2 text-sm ${draft.fulfilment === value ? "border-accent bg-accent/10 text-accent font-medium" : "border-border"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {draft.fulfilment === "delivery" && (
            <div className="space-y-2">
              <textarea
                className="input"
                rows={2}
                placeholder="Delivery address"
                value={draft.delivery.address}
                disabled={stage === "pay"}
                onChange={(e) => set({ delivery: { ...draft.delivery, address: e.target.value } })}
                aria-label="Delivery address"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input"
                  placeholder="Area, e.g. Lekki"
                  value={draft.delivery.area}
                  disabled={stage === "pay"}
                  onChange={(e) => set({ delivery: { ...draft.delivery, area: e.target.value } })}
                  aria-label="Delivery area"
                />
                <input
                  className="input"
                  type="date"
                  value={draft.delivery.date}
                  disabled={stage === "pay"}
                  onChange={(e) => set({ delivery: { ...draft.delivery, date: e.target.value } })}
                  aria-label="Delivery date"
                />
              </div>
              <input
                className="input tabular-nums"
                placeholder={`Delivery fee (${currency})`}
                inputMode="decimal"
                value={draft.delivery.fee}
                disabled={stage === "pay"}
                onChange={(e) => set({ delivery: { ...draft.delivery, fee: e.target.value } })}
                aria-label="Delivery fee"
              />
            </div>
          )}
          {draft.fulfilment === "collect_later" && (
            <p className="text-muted text-xs">The items are set aside for the customer and removed from stock now.</p>
          )}
          <input
            className="input"
            placeholder="Note (optional)"
            value={draft.note}
            disabled={stage === "pay"}
            onChange={(e) => set({ note: e.target.value })}
            aria-label="Sale note"
          />
        </section>

        <section className="card space-y-3 p-4">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Items</dt>
              <dd className="tabular-nums">{formatMoney(subtotal, currency)}</dd>
            </div>
            {discount && discountKobo > 0 && (
              <div className="text-success flex justify-between">
                <dt>Discount ({formatQty(Math.round(discountPct * 10) / 10)}%)</dt>
                <dd className="tabular-nums">−{formatMoney(discountKobo, currency)}</dd>
              </div>
            )}
            {draft.fulfilment === "delivery" && (
              <div className="flex justify-between">
                <dt className="text-muted">Delivery</dt>
                <dd className="tabular-nums">{formatMoney(Number.isNaN(fee) ? 0 : fee, currency)}</dd>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(total, currency)}</dd>
            </div>
          </dl>

          {stage === "cart" && !exchange && discountLimit > 0 && (
            <DiscountBox discount={draft.discount} limit={discountLimit} onChange={(d) => set({ discount: d })} />
          )}

          {stage === "cart" ? (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary flex-1 py-3 text-base"
                disabled={draft.lines.length === 0}
                onClick={startPayment}
              >
                {exchange
                  ? `Charge ${formatMoney(Math.max(total - credit, 0), currency)} (after credit)`
                  : `Charge ${formatMoney(total, currency)}`}
              </button>
              {draft.lines.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => confirm("Clear this sale?") && (setDraft(EMPTY), setUnavailable(null))}
                >
                  Clear
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {exchange && (
                <div className="bg-background flex justify-between gap-2 rounded-md p-3 text-sm">
                  <span>
                    Exchange credit <span className="text-muted">· {exchange.sale_number}</span>
                  </span>
                  <span className="font-medium tabular-nums">{formatMoney(credit, currency)}</span>
                </div>
              )}
              {payments.map((p, i) => {
                const amount = parseMoney(p.amount) || 0;
                const tendered = parseMoney(p.tendered);
                const change = p.method === "cash" && tendered && tendered > amount ? tendered - amount : 0;
                return (
                  <div key={i} className="bg-background space-y-2 rounded-md p-3">
                    <div className="grid grid-cols-3 gap-1">
                      {(Object.keys(METHOD_LABELS) as Payment["method"][]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, method: m } : x)))}
                          className={`rounded-md border px-1 py-2 text-xs ${p.method === m ? "border-accent bg-accent/10 text-accent font-medium" : "border-border bg-surface"}`}
                        >
                          {METHOD_LABELS[m]}
                        </button>
                      ))}
                    </div>
                    <label className="block">
                      <span className="label text-xs">Amount</span>
                      <input
                        className="input tabular-nums"
                        inputMode="decimal"
                        value={p.amount}
                        onChange={(e) =>
                          setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
                        }
                      />
                    </label>
                    {p.method === "cash" ? (
                      <label className="block">
                        <span className="label text-xs">Cash received (for change)</span>
                        <input
                          className="input tabular-nums"
                          inputMode="decimal"
                          value={p.tendered}
                          placeholder="Optional"
                          onChange={(e) =>
                            setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, tendered: e.target.value } : x)))
                          }
                        />
                        {change > 0 && (
                          <span className="mt-1 block text-sm font-semibold">
                            Change: {formatMoney(change, currency)}
                          </span>
                        )}
                      </label>
                    ) : (
                      <input
                        className="input"
                        placeholder={p.method === "transfer" ? "Sender name / reference" : "Terminal ref (optional)"}
                        value={p.reference}
                        onChange={(e) =>
                          setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))
                        }
                        aria-label="Payment reference"
                      />
                    )}
                    {payments.length > 1 && (
                      <button
                        type="button"
                        className="text-danger text-xs hover:underline"
                        onClick={() => setPayments((ps) => ps.filter((_, j) => j !== i))}
                      >
                        Remove payment
                      </button>
                    )}
                  </div>
                );
              })}
              {remaining > 0 && (
                <button
                  type="button"
                  className="text-accent text-sm hover:underline"
                  onClick={() =>
                    setPayments((ps) => [
                      ...ps,
                      { method: "transfer", amount: toMoneyInput(remaining), tendered: "", reference: "" },
                    ])
                  }
                >
                  + Split: add another payment ({formatMoney(remaining, currency)} left)
                </button>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary flex-1 py-3 text-base"
                  disabled={pending}
                  onClick={complete}
                >
                  {pending ? "Completing…" : "Complete sale"}
                </button>
                <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setStage("cart")}>
                  Back
                </button>
              </div>
            </div>
          )}
        </section>
      </aside>

      {calcLine && (
        <Calculator
          item={calcLine.item}
          onClose={() => setCalculatorFor(null)}
          onApply={(qty) => {
            setLine(calcLine.key, { quantity: String(qty) });
            setCalculatorFor(null);
          }}
        />
      )}
    </div>
  );
}

/** Add, change or remove the sale's discount. The limit is checked again by the database. */
function DiscountBox({
  discount,
  limit,
  onChange,
}: {
  discount: Discount | null;
  limit: number;
  onChange: (d: Discount | null) => void;
}) {
  if (!discount)
    return (
      <button
        type="button"
        className="text-accent text-sm hover:underline"
        onClick={() => onChange({ type: "percent", value: "", reason: "" })}
      >
        + Discount {limit < 100 && <span className="text-muted">(up to {formatQty(limit)}%)</span>}
      </button>
    );
  return (
    <div className="bg-background space-y-2 rounded-md p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">Discount</span>
        <button type="button" className="text-danger text-xs hover:underline" onClick={() => onChange(null)}>
          Remove
        </button>
      </div>
      <div className="flex gap-2">
        <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Discount type">
          {(["percent", "amount"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={discount.type === t}
              onClick={() => onChange({ ...discount, type: t, value: "" })}
              className={`rounded-md border px-3 py-2 text-xs ${discount.type === t ? "border-accent bg-accent/10 text-accent font-medium" : "border-border bg-surface"}`}
            >
              {t === "percent" ? "%" : "₦"}
            </button>
          ))}
        </div>
        <input
          className="input tabular-nums"
          inputMode="decimal"
          aria-label={discount.type === "percent" ? "Discount percentage" : "Discount amount"}
          placeholder={discount.type === "percent" ? "e.g. 10" : "e.g. 5000"}
          value={discount.value}
          onChange={(e) => onChange({ ...discount, value: e.target.value })}
        />
      </div>
      <input
        className="input"
        aria-label="Discount reason"
        placeholder="Reason (required), e.g. loyal customer"
        value={discount.reason}
        onChange={(e) => onChange({ ...discount, reason: e.target.value })}
      />
      <p className="text-muted text-xs">
        {limit >= 100 ? "No limit." : `Your limit: ${formatQty(limit)}% of the items.`}
      </p>
    </div>
  );
}
