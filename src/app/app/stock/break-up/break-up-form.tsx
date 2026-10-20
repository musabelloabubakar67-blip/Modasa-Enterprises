"use client";

import { useState, useTransition } from "react";
import { SkuPicker, skuLabel } from "@/components/sku-picker";
import { formatQty } from "@/lib/quantity";
import type { LocationSummary } from "../data";
import { breakUpSet, type SkuOption } from "../actions";

function PickedItem({ sku, onClear }: { sku: SkuOption; onClear: () => void }) {
  return (
    <div className="card flex items-center justify-between gap-3 p-3">
      <div>
        <p className="font-medium">{skuLabel(sku)}</p>
        <p className="text-muted font-mono text-xs">
          {sku.code} · {sku.unit}
        </p>
      </div>
      <button type="button" className="text-danger px-2 py-2 text-sm hover:underline" onClick={onClear}>
        Change
      </button>
    </div>
  );
}

export function BreakUpForm({ locations }: { locations: LocationSummary[] }) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [setSku, setSetSku] = useState<SkuOption | null>(null);
  const [pieceSku, setPieceSku] = useState<SkuOption | null>(null);
  const [sets, setSets] = useState("1");
  const [perSet, setPerSet] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = Number(sets) * Number(perSet);
  const ready = setSku && pieceSku && Number(sets) > 0 && Number(perSet) > 0;

  function submit() {
    setError(null);
    if (!setSku || !pieceSku) return setError("Choose the set and the single-piece item.");
    if (setSku.id === pieceSku.id) return setError("The set and the single piece must be different items.");
    const location = locations.find((l) => l.id === locationId)?.name;
    const message = `At ${location}: take ${sets} × ${skuLabel(setSku)} out of stock and add ${formatQty(total)} × ${skuLabel(pieceSku)}?`;
    if (!confirm(message)) return;

    startTransition(async () => {
      const result = await breakUpSet({
        location_id: locationId,
        set_sku_id: setSku.id,
        sets,
        piece_sku_id: pieceSku.id,
        pieces_per_set: perSet,
        note: note || undefined,
      });
      if (result?.error) setError(result.error);
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
        <div>
          <label htmlFor="location" className="label">
            Location
          </label>
          <select
            id="location"
            className="input"
            value={locationId}
            disabled={locations.length === 1}
            onChange={(e) => setLocationId(e.target.value)}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="label">The set</p>
          {setSku ? (
            <PickedItem sku={setSku} onClear={() => setSetSku(null)} />
          ) : (
            <SkuPicker onPick={setSetSku} placeholder="Search for the set, e.g. Knife Set" />
          )}
          <label className="block w-32">
            <span className="label text-xs">Sets to break up</span>
            <input
              className="input text-right tabular-nums"
              inputMode="numeric"
              value={sets}
              onChange={(e) => setSets(e.target.value)}
            />
          </label>
        </div>

        <div className="space-y-2">
          <p className="label">Becomes</p>
          {pieceSku ? (
            <PickedItem sku={pieceSku} onClear={() => setPieceSku(null)} />
          ) : (
            <SkuPicker onPick={setPieceSku} placeholder="Search for the single piece" />
          )}
          <label className="block w-32">
            <span className="label text-xs">Pieces in each set</span>
            <input
              className="input text-right tabular-nums"
              inputMode="numeric"
              value={perSet}
              onChange={(e) => setPerSet(e.target.value)}
            />
          </label>
        </div>

        <div>
          <label htmlFor="note" className="label">
            Note
          </label>
          <input
            id="note"
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional, e.g. customer wanted one piece"
          />
        </div>

        {ready && (
          <p className="bg-accent/5 rounded-md px-3 py-2 text-sm">
            −{sets} × {skuLabel(setSku)} · +{formatQty(total)} × {skuLabel(pieceSku)}
          </p>
        )}
      </section>

      <button type="button" className="btn btn-primary" disabled={pending || !ready} onClick={submit}>
        {pending ? "Working…" : "Break up"}
      </button>
    </div>
  );
}
