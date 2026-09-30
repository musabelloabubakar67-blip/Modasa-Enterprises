"use client";

import { useEffect, useState, useTransition } from "react";
import { SkuPicker, skuLabel } from "@/components/sku-picker";
import { formatQty } from "@/lib/quantity";
import type { SkuOption } from "../stock/actions";
import type { LocationSummary } from "../stock/data";
import { availableAt, createTransfer, lowStockSuggestions } from "./actions";

type Line = { sku: SkuOption; quantity: string };

/** Floor staff must be at one end of a transfer; the database enforces that and explains if not. */
export function TransferForm({
  locations,
  initialFrom,
  initialTo,
}: {
  locations: LocationSummary[];
  initialFrom: string;
  initialTo: string;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [available, setAvailable] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const name = (id: string) => locations.find((l) => l.id === id)?.name ?? "";

  // Keep "available at source" up to date when the source or the items change.
  const skuKey = lines.map((l) => l.sku.id).join(",");
  useEffect(() => {
    if (!from || !skuKey) return;
    let cancelled = false;
    availableAt(from, skuKey.split(",")).then((a) => !cancelled && setAvailable(a));
    return () => {
      cancelled = true;
    };
  }, [from, skuKey]);

  function add(sku: SkuOption, quantity = "1") {
    setLines((ls) =>
      ls.some((l) => l.sku.id === sku.id)
        ? ls.map((l) => (l.sku.id === sku.id ? { ...l, quantity: String(Number(l.quantity) + Number(quantity)) } : l))
        : [...ls, { sku, quantity }],
    );
  }

  function addLowStock() {
    setInfo(null);
    startTransition(async () => {
      const suggestions = await lowStockSuggestions(to);
      if (suggestions.length === 0)
        setInfo(`Nothing at ${name(to)} needs restocking — counting stock on its way and requests not yet sent.`);
      else {
        suggestions.forEach((s) => add(s.sku, String(s.quantity)));
        setInfo(`Added ${suggestions.length} low-stock item${suggestions.length === 1 ? "" : "s"} for ${name(to)}.`);
      }
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createTransfer({
        from_location_id: from,
        to_location_id: to,
        note: note || undefined,
        lines: lines.map((l) => ({ sku_id: l.sku.id, quantity: l.quantity })),
      });
      if (result?.error) {
        setError(result.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  const fromOptions = locations.filter((l) => l.id !== to);
  const toOptions = locations.filter((l) => l.id !== from);

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label htmlFor="from" className="label">
            From
          </label>
          <select id="from" className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="" disabled>
              Choose…
            </option>
            {fromOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="to" className="label">
            To
          </label>
          <select id="to" className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="" disabled>
              Choose…
            </option>
            {toOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="note" className="label">
            Note
          </label>
          <input
            id="note"
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional, e.g. customer waiting for this"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Items</h2>
          {to && (
            <button type="button" className="btn btn-secondary" onClick={addLowStock} disabled={pending}>
              Add low-stock items for {name(to)}
            </button>
          )}
        </div>
        {info && <p className="text-muted text-sm">{info}</p>}
        <SkuPicker onPick={(sku) => add(sku)} />
        {lines.length === 0 ? (
          <p className="card text-muted p-4 text-sm">No items yet.</p>
        ) : (
          <ul className="card divide-border divide-y">
            {lines.map((line, i) => {
              const have = available[line.sku.id] ?? 0;
              const tooMany = Number(line.quantity) > have;
              return (
                <li key={line.sku.id} className="flex flex-wrap items-end gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{skuLabel(line.sku)}</p>
                    <p className={`text-xs ${tooMany ? "text-danger" : "text-muted"}`}>
                      <span className="font-mono">{line.sku.code}</span> · {formatQty(have)} {line.sku.unit} at{" "}
                      {name(from) || "source"}
                      {tooMany && " — not enough to send all of this"}
                    </p>
                  </div>
                  <label className="w-24">
                    <span className="label text-xs">Qty ({line.sku.unit})</span>
                    <input
                      className="input text-right tabular-nums"
                      inputMode={line.sku.allows_decimal ? "decimal" : "numeric"}
                      value={line.quantity}
                      onChange={(e) =>
                        setLines((ls) => ls.map((l, j) => (j === i ? { ...l, quantity: e.target.value } : l)))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="text-danger px-2 py-2 text-sm hover:underline"
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button
        type="button"
        className="btn btn-primary"
        disabled={pending || !from || !to || lines.length === 0}
        onClick={submit}
      >
        {pending ? "Working…" : "Create transfer request"}
      </button>
    </div>
  );
}
