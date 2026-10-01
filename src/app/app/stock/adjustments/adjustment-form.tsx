"use client";

import { useState, useTransition } from "react";
import { SkuPicker, skuLabel } from "@/components/sku-picker";
import { formatQty } from "@/lib/quantity";
import { ADJUSTMENT_LABELS } from "../labels";
import type { LocationSummary } from "../data";
import { batchesAt, submitAdjustment, type SkuOption } from "../actions";

type Kind = keyof typeof ADJUSTMENT_LABELS;

type Line = {
  sku: SkuOption;
  batch: string;
  quantity: string;
  reason: string;
  /** Batches with stock at this location, for batch-tracked items. */
  batches: { batch: string; quantity: number }[];
};

const DAMAGE_REASONS = ["Broken", "Water damage", "Torn / cut", "Missing", "Faulty", "Other"];

const HELP: Record<Kind, string> = {
  count:
    "Count what is physically there and enter the numbers. Only items you list are changed. The system records the difference.",
  damage: "Remove damaged, lost or unsellable items from stock. Give a reason for each.",
  opening:
    "Enter the starting quantities when you first go live at a location. Replaces nothing — it sets the baseline.",
};

export function AdjustmentForm({
  locations,
  kinds,
  initialKind,
  needsApproval,
}: {
  locations: LocationSummary[];
  kinds: Kind[];
  initialKind: Kind;
  needsApproval: boolean;
}) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function addSku(sku: SkuOption) {
    const batches = sku.track_batches
      ? (await batchesAt(sku.id, locationId)).map((b) => ({ batch: b.batch, quantity: Number(b.quantity) }))
      : [];
    const inStock = batches.filter((b) => b.quantity > 0);
    setLines((ls) => [
      ...ls,
      {
        sku,
        batches,
        batch: inStock.length === 1 ? inStock[0].batch : "",
        quantity: kind === "damage" ? "1" : "",
        reason: kind === "damage" ? DAMAGE_REASONS[0] : "",
      },
    ]);
  }

  function submit() {
    setError(null);
    const noBatch = lines.find((l) => l.sku.track_batches && kind !== "opening" && !l.batch && l.batches.length > 0);
    if (noBatch) return setError(`Choose which batch of ${skuLabel(noBatch.sku)}.`);
    const noQty = lines.find((l) => l.quantity.trim() === "");
    if (noQty) return setError(`Enter a quantity for ${skuLabel(noQty.sku)}.`);
    const message = needsApproval
      ? "Submit for a manager to approve? Stock changes once it's approved."
      : "Apply this now? Stock will change immediately.";
    if (!confirm(message)) return;

    startTransition(async () => {
      const result = await submitAdjustment({
        location_id: locationId,
        kind,
        note: note || undefined,
        lines: lines.map((l) => ({
          sku_id: l.sku.id,
          batch: l.batch,
          quantity: l.quantity,
          reason: l.reason || undefined,
        })),
      });
      if (result?.error) {
        setError(result.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <section className="card space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="kind" className="label">
              Type
            </label>
            <select
              id="kind"
              className="input"
              value={kind}
              disabled={lines.length > 0}
              onChange={(e) => setKind(e.target.value as Kind)}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {ADJUSTMENT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="location" className="label">
              Location
            </label>
            <select
              id="location"
              className="input"
              value={locationId}
              disabled={lines.length > 0 || locations.length === 1}
              onChange={(e) => setLocationId(e.target.value)}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {lines.length > 0 && <p className="text-muted text-xs">Remove all items to change the type or location.</p>}
        <p className="text-muted text-sm">{HELP[kind]}</p>
        <div>
          <label htmlFor="note" className="label">
            Note
          </label>
          <input
            id="note"
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={kind === "count" ? "e.g. Monthly count, rugs section" : "Optional"}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Items</h2>
        <SkuPicker onPick={addSku} captureScans />
        {lines.length === 0 ? (
          <p className="card text-muted p-4 text-sm">No items yet. Search above or scan a barcode.</p>
        ) : (
          <ul className="card divide-border divide-y">
            {lines.map((line, i) => {
              const available = line.batches.find((b) => b.batch === line.batch)?.quantity;
              return (
                <li key={`${line.sku.id}-${i}`} className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <p className="font-medium">{skuLabel(line.sku)}</p>
                    <p className="text-muted font-mono text-xs">{line.sku.code}</p>
                    {kind === "damage" && available !== undefined && (
                      <p className="text-muted text-xs">
                        In stock: {formatQty(available)} {line.sku.unit}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    {line.sku.track_batches && (
                      <label className="w-36">
                        <span className="label text-xs">Batch</span>
                        {kind === "damage" ? (
                          <select
                            className="input"
                            value={line.batch}
                            onChange={(e) => setLine(i, { batch: e.target.value })}
                          >
                            <option value="">Choose…</option>
                            {line.batches
                              .filter((b) => b.quantity > 0)
                              .map((b) => (
                                <option key={b.batch} value={b.batch}>
                                  {b.batch || "No batch"} ({formatQty(b.quantity)})
                                </option>
                              ))}
                          </select>
                        ) : (
                          <>
                            <input
                              className="input"
                              list={`batches-${i}`}
                              value={line.batch}
                              onChange={(e) => setLine(i, { batch: e.target.value })}
                              placeholder="Batch no."
                            />
                            <datalist id={`batches-${i}`}>
                              {line.batches.map((b) => (
                                <option key={b.batch} value={b.batch} />
                              ))}
                            </datalist>
                          </>
                        )}
                      </label>
                    )}
                    <label className="w-24">
                      <span className="label text-xs">
                        {kind === "damage" ? "Write off" : "Counted"} ({line.sku.unit})
                      </span>
                      <input
                        className="input text-right tabular-nums"
                        inputMode={line.sku.allows_decimal ? "decimal" : "numeric"}
                        value={line.quantity}
                        onChange={(e) => setLine(i, { quantity: e.target.value })}
                      />
                    </label>
                    {kind === "damage" && (
                      <label className="w-36">
                        <span className="label text-xs">Reason</span>
                        <select
                          className="input"
                          value={line.reason}
                          onChange={(e) => setLine(i, { reason: e.target.value })}
                        >
                          {DAMAGE_REASONS.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button
                      type="button"
                      className="text-danger px-2 py-2 text-sm hover:underline"
                      onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button type="button" className="btn btn-primary" disabled={pending || lines.length === 0} onClick={submit}>
        {pending ? "Working…" : needsApproval ? "Submit for approval" : "Apply to stock"}
      </button>
    </div>
  );
}
