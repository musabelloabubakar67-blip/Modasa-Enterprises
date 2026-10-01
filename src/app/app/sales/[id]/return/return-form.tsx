"use client";

import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/money";
import { formatQty } from "@/lib/quantity";
import { createReturn } from "../../actions";

type Line = {
  id: string;
  label: string;
  code: string;
  unit: string;
  allows_decimal: boolean;
  returnable: number;
  unit_price_kobo: number;
};

export function ReturnForm({ saleId, lines, currency }: { saleId: string; lines: Line[]; currency: string }) {
  const [values, setValues] = useState(() => lines.map(() => ({ quantity: "0", condition: "restock" as const })));
  const [method, setMethod] = useState<"cash" | "card" | "transfer">("cash");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refund = lines.reduce((s, l, i) => s + Math.round(l.unit_price_kobo * (Number(values[i].quantity) || 0)), 0);
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
    if (refund === 0) return setError("Choose at least one item to return.");
    if (!reason.trim()) return setError("Give a reason for the return.");
    if (!confirm(`Refund ${formatMoney(refund, currency)} by ${method}?`)) return;
    startTransition(async () => {
      const result = await createReturn({
        sale_id: saleId,
        refund_method: method,
        reason,
        lines: lines.map((l, i) => ({
          sale_line_id: l.id,
          quantity: Number(values[i].quantity) || 0,
          condition: values[i].condition,
        })),
      });
      if (result?.error) setError(result.error);
    });
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
        <label className="block">
          <span className="label">Refund by</span>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
            <option value="cash">Cash (from the till)</option>
            <option value="transfer">Bank transfer</option>
            <option value="card">Card reversal</option>
          </select>
        </label>
        <div className="flex items-end justify-between gap-2">
          <p className="text-lg font-semibold">Refund {formatMoney(refund, currency)}</p>
        </div>
      </section>
      <p className="text-muted text-xs">
        For an exchange, record the return here, then ring up the new item as a normal sale.
      </p>
      <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>
        {pending ? "Working…" : "Record return and refund"}
      </button>
    </div>
  );
}
