"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveExchange } from "@/lib/exchange";
import { formatMoney } from "@/lib/money";
import { formatQty } from "@/lib/quantity";

type Line = {
  id: string;
  label: string;
  code: string;
  unit: string;
  allows_decimal: boolean;
  returnable: number;
  unit_price_kobo: number;
};

/**
 * Chooses what comes back in an exchange, then hands over to the till, where the replacement is rung up.
 * Nothing is saved until the exchange is completed there.
 */
export function ExchangeForm({
  sale,
  lines,
  currency,
}: {
  sale: { id: string; number: string; locationId: string };
  lines: Line[];
  currency: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(() => lines.map(() => ({ quantity: "0", condition: "restock" as const })));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const credit = lines.reduce((s, l, i) => s + Math.round(l.unit_price_kobo * (Number(values[i].quantity) || 0)), 0);
  const set = (i: number, patch: Partial<(typeof values)[number]>) =>
    setValues((v) => v.map((x, j) => (j === i ? ({ ...x, ...patch } as (typeof values)[number]) : x)));

  function submit() {
    setError(null);
    for (const [i, l] of lines.entries()) {
      const q = Number(values[i].quantity);
      if (!(q >= 0) || q > l.returnable)
        return setError(`${l.label}: return between 0 and ${formatQty(l.returnable)}.`);
      if (!l.allows_decimal && !Number.isInteger(q)) return setError(`${l.label} is returned in whole ${l.unit}.`);
    }
    if (credit === 0) return setError("Choose at least one item to bring back.");
    if (!reason.trim()) return setError("Give a reason for the exchange.");
    const saved = saveExchange(sale.locationId, {
      sale_id: sale.id,
      sale_number: sale.number,
      reason: reason.trim(),
      credit_kobo: credit,
      lines: lines.flatMap((l, i) => {
        const quantity = Number(values[i].quantity) || 0;
        return quantity > 0
          ? [
              {
                sale_line_id: l.id,
                quantity,
                condition: values[i].condition,
                label: l.label,
                credit_kobo: Math.round(l.unit_price_kobo * quantity),
              },
            ]
          : [];
      }),
    });
    if (!saved) return setError("This browser can't store the exchange. Check it isn't in private mode.");
    router.push(`/app/pos?shop=${sale.locationId}`);
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <ul className="card divide-border divide-y">
        {lines.map((l, i) => (
          <li key={l.id} className="flex flex-wrap items-end gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{l.label}</p>
              <p className="text-muted text-xs">
                <span className="font-mono">{l.code}</span> · {formatQty(l.returnable)} {l.unit} can be returned ·{" "}
                {formatMoney(l.unit_price_kobo, currency)} each
              </p>
            </div>
            <label className="w-24">
              <span className="label text-xs">Returning</span>
              <input
                className="input text-right tabular-nums"
                inputMode={l.allows_decimal ? "decimal" : "numeric"}
                value={values[i].quantity}
                onChange={(e) => set(i, { quantity: e.target.value })}
              />
            </label>
            <label className="w-44">
              <span className="label text-xs">Condition</span>
              <select
                className="input"
                value={values[i].condition}
                onChange={(e) => set(i, { condition: e.target.value as "restock" })}
              >
                <option value="restock">Good — back on sale</option>
                <option value="damaged">Damaged — write off</option>
              </select>
            </label>
          </li>
        ))}
      </ul>
      <section className="card grid gap-3 p-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="label">Reason</span>
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Wrong size, colour doesn't match"
          />
        </label>
        <div className="flex items-end justify-between gap-2 sm:col-span-2">
          <p className="text-muted text-sm">
            The customer chooses replacement items worth at least this much, and tops up any difference.
          </p>
          <p className="shrink-0 text-lg font-semibold">Credit {formatMoney(credit, currency)}</p>
        </div>
      </section>
      <p className="text-muted text-xs">
        No cash refunds: returned items are exchanged for items of equal or higher value, chosen now.
      </p>
      <button type="button" className="btn btn-primary" onClick={submit}>
        Continue at the till →
      </button>
    </div>
  );
}
