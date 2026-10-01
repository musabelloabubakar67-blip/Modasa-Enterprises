"use client";

import { useState, useTransition } from "react";
import { SkuPicker, skuLabel } from "@/components/sku-picker";
import type { LocationSummary } from "../data";
import { cancelReceipt, saveReceipt, type SkuOption } from "../actions";

export type ReceiptFormLine = {
  sku: Pick<SkuOption, "id" | "code" | "variant_label" | "product_name" | "unit" | "allows_decimal" | "track_batches">;
  batch: string;
  quantity: string;
  unit_cost: string;
};

export type ReceiptFormData = {
  id?: string;
  location_id: string;
  supplier_name: string;
  supplier_reference: string;
  received_on: string;
  note: string;
  lines: ReceiptFormLine[];
};

export function ReceiptForm({
  initial,
  warehouses,
  canCost,
  currency,
}: {
  initial: ReceiptFormData;
  warehouses: LocationSummary[];
  canCost: boolean;
  currency: string;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<ReceiptFormData>) => setForm((f) => ({ ...f, ...patch }));
  const setLine = (i: number, patch: Partial<ReceiptFormLine>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  function addSku(sku: SkuOption) {
    setForm((f) => {
      // Scanning the same untracked item again adds one more rather than a new line.
      const existing = f.lines.findIndex((l) => l.sku.id === sku.id && !sku.track_batches);
      if (existing >= 0) {
        return {
          ...f,
          lines: f.lines.map((l, j) =>
            j === existing ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l,
          ),
        };
      }
      return { ...f, lines: [...f.lines, { sku, batch: "", quantity: "1", unit_cost: "" }] };
    });
  }

  function submit(post: boolean) {
    setError(null);
    const missingBatch = form.lines.find((l) => l.sku.track_batches && !l.batch.trim());
    if (post && missingBatch) {
      setError(`Enter the batch number for ${skuLabel(missingBatch.sku)} (printed on the label).`);
      return;
    }
    if (post && !confirm("Post this delivery? Stock will be added and the delivery can no longer be edited.")) return;
    startTransition(async () => {
      const result = await saveReceipt(
        {
          id: form.id,
          location_id: form.location_id,
          supplier_name: form.supplier_name || undefined,
          supplier_reference: form.supplier_reference || undefined,
          received_on: form.received_on,
          note: form.note || undefined,
          lines: form.lines.map((l) => ({
            sku_id: l.sku.id,
            batch: l.batch,
            quantity: l.quantity,
            unit_cost: l.unit_cost,
          })),
        },
        post,
      );
      if (result?.error) {
        setError(result.error);
        if (result.id) set({ id: result.id });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  function cancel() {
    if (!form.id || !confirm("Cancel this draft delivery?")) return;
    startTransition(async () => {
      const result = await cancelReceipt(form.id!);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label htmlFor="location_id" className="label">
            Warehouse
          </label>
          <select
            id="location_id"
            className="input"
            value={form.location_id}
            onChange={(e) => set({ location_id: e.target.value })}
            disabled={warehouses.length === 1}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="received_on" className="label">
            Date received
          </label>
          <input
            id="received_on"
            type="date"
            className="input"
            value={form.received_on}
            onChange={(e) => set({ received_on: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="supplier_name" className="label">
            Supplier
          </label>
          <input
            id="supplier_name"
            className="input"
            value={form.supplier_name}
            onChange={(e) => set({ supplier_name: e.target.value })}
            placeholder="Optional"
          />
        </div>
        <div>
          <label htmlFor="supplier_reference" className="label">
            Invoice / waybill no.
          </label>
          <input
            id="supplier_reference"
            className="input"
            value={form.supplier_reference}
            onChange={(e) => set({ supplier_reference: e.target.value })}
            placeholder="Optional"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="note" className="label">
            Note
          </label>
          <input
            id="note"
            className="input"
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="Optional, e.g. container number"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Items received</h2>
        <SkuPicker onPick={addSku} captureScans />

        {form.lines.length === 0 ? (
          <p className="card text-muted p-4 text-sm">No items yet. Search above or scan a barcode.</p>
        ) : (
          <ul className="card divide-border divide-y">
            {form.lines.map((line, i) => (
              <li key={`${line.sku.id}-${i}`} className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <p className="font-medium">{skuLabel(line.sku)}</p>
                  <p className="text-muted font-mono text-xs">{line.sku.code}</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  {line.sku.track_batches && (
                    <label className="w-32">
                      <span className="label text-xs">Batch no.</span>
                      <input
                        className={`input ${!line.batch.trim() ? "border-danger/50" : ""}`}
                        value={line.batch}
                        onChange={(e) => setLine(i, { batch: e.target.value })}
                        placeholder="Required"
                      />
                    </label>
                  )}
                  <label className="w-24">
                    <span className="label text-xs">Qty ({line.sku.unit})</span>
                    <input
                      className="input text-right tabular-nums"
                      inputMode={line.sku.allows_decimal ? "decimal" : "numeric"}
                      value={line.quantity}
                      onChange={(e) => setLine(i, { quantity: e.target.value })}
                    />
                  </label>
                  {canCost && (
                    <label className="w-32">
                      <span className="label text-xs">Unit cost ({currency})</span>
                      <input
                        className="input text-right tabular-nums"
                        inputMode="decimal"
                        value={line.unit_cost}
                        onChange={(e) => setLine(i, { unit_cost: e.target.value })}
                        placeholder="Optional"
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    className="text-danger px-2 py-2 text-sm hover:underline"
                    onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}
                    aria-label={`Remove ${skuLabel(line.sku)}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {canCost && (
          <p className="text-muted text-xs">
            Unit costs you enter here become each item&apos;s cost price when posted.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || !form.lines.length}
          onClick={() => submit(true)}
        >
          {pending ? "Working…" : "Post delivery (add to stock)"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending || !form.lines.length}
          onClick={() => submit(false)}
        >
          Save draft
        </button>
        {form.id && (
          <button type="button" className="btn text-danger ml-auto" disabled={pending} onClick={cancel}>
            Cancel draft
          </button>
        )}
      </div>
    </div>
  );
}
