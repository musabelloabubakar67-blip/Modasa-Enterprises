"use client";

import { useState, useTransition } from "react";
import { formatQty } from "@/lib/quantity";
import { cancelTransfer, dispatchTransfer, receiveTransfer, resolveShortage } from "../actions";

export type DispatchLine = {
  sku_id: string;
  label: string;
  code: string;
  unit: string;
  allows_decimal: boolean;
  track_batches: boolean;
  requested: number;
  /** Stock at the source, per batch ('' = no batch). */
  batches: { batch: string; quantity: number }[];
};

type Row = { batch: string; quantity: string };

/**
 * Suggests which batches to send. For batch-tracked items, one batch that covers the whole
 * quantity is preferred (the smallest such batch, to use up remnants) so a shop never gets mixed
 * shades. Otherwise it splits across the largest batches and the panel warns.
 */
function suggest(line: DispatchLine): Row[] {
  const inStock = line.batches.filter((b) => b.quantity > 0);
  const total = inStock.reduce((s, b) => s + b.quantity, 0);
  const want = Math.min(line.requested, total);
  if (!line.track_batches) return [{ batch: "", quantity: formatQty(want) }];
  if (want === 0) return [{ batch: "", quantity: "0" }];

  const single = inStock.filter((b) => b.quantity >= want).sort((a, b) => a.quantity - b.quantity)[0];
  if (single) return [{ batch: single.batch, quantity: formatQty(want) }];

  const rows: Row[] = [];
  let left = want;
  for (const b of [...inStock].sort((a, b) => b.quantity - a.quantity)) {
    if (left <= 0) break;
    const take = Math.min(b.quantity, left);
    rows.push({ batch: b.batch, quantity: formatQty(take) });
    left -= take;
  }
  return rows;
}

function ErrorBox({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
      {error}
    </p>
  ) : null;
}

export function DispatchForm({
  transferId,
  lines,
  fromName,
}: {
  transferId: string;
  lines: DispatchLine[];
  fromName: string;
}) {
  const [rows, setRows] = useState<Row[][]>(() => lines.map(suggest));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setRow = (li: number, ri: number, patch: Partial<Row>) =>
    setRows((all) => all.map((r, i) => (i === li ? r.map((row, j) => (j === ri ? { ...row, ...patch } : row)) : r)));

  function submit() {
    setError(null);
    const items = lines.flatMap((line, li) =>
      rows[li].map((row) => ({ sku_id: line.sku_id, batch: row.batch, quantity: row.quantity || "0" })),
    );
    const missingBatch = lines.find(
      (line, li) => line.track_batches && rows[li].some((r) => Number(r.quantity) > 0 && !r.batch),
    );
    if (missingBatch) return setError(`Choose a batch for ${missingBatch.label}.`);
    if (!confirm(`Send these items? Stock will leave ${fromName} now.`)) return;
    startTransition(async () => {
      const result = await dispatchTransfer(transferId, items, note);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <section className="card space-y-4 p-4">
      <div>
        <h2 className="font-semibold">Send these items</h2>
        <p className="text-muted text-sm">
          Enter what you are actually sending. It can be less than requested. For wallpaper and tiles, send one batch
          where possible.
        </p>
      </div>
      <ErrorBox error={error} />
      <ul className="divide-border divide-y">
        {lines.map((line, li) => {
          const inStock = line.batches.filter((b) => b.quantity > 0);
          const total = inStock.reduce((s, b) => s + b.quantity, 0);
          const sending = rows[li].reduce((s, r) => s + (Number(r.quantity) || 0), 0);
          const mixed = line.track_batches && rows[li].filter((r) => Number(r.quantity) > 0).length > 1;
          return (
            <li key={line.sku_id} className="space-y-2 py-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium">{line.label}</p>
                  <p className="text-muted text-xs">
                    <span className="font-mono">{line.code}</span> · requested {formatQty(line.requested)} ·{" "}
                    {formatQty(total)} {line.unit} at {fromName}
                  </p>
                </div>
                <p className={`text-sm tabular-nums ${sending < line.requested ? "text-amber-700" : ""}`}>
                  Sending {formatQty(sending)} of {formatQty(line.requested)}
                </p>
              </div>
              {rows[li].map((row, ri) => (
                <div key={ri} className="flex flex-wrap items-end gap-2">
                  {line.track_batches && (
                    <label className="w-44">
                      <span className="label text-xs">Batch</span>
                      <select
                        className="input"
                        value={row.batch}
                        onChange={(e) => setRow(li, ri, { batch: e.target.value })}
                      >
                        <option value="">Choose…</option>
                        {inStock.map((b) => (
                          <option key={b.batch} value={b.batch}>
                            {b.batch || "No batch"} ({formatQty(b.quantity)} available)
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="w-24">
                    <span className="label text-xs">Send ({line.unit})</span>
                    <input
                      className="input text-right tabular-nums"
                      inputMode={line.allows_decimal ? "decimal" : "numeric"}
                      value={row.quantity}
                      onChange={(e) => setRow(li, ri, { quantity: e.target.value })}
                    />
                  </label>
                  {rows[li].length > 1 && (
                    <button
                      type="button"
                      className="text-danger px-2 py-2 text-xs hover:underline"
                      onClick={() => setRows((all) => all.map((r, i) => (i === li ? r.filter((_, j) => j !== ri) : r)))}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {line.track_batches && inStock.length > 1 && (
                <button
                  type="button"
                  className="text-accent text-xs hover:underline"
                  onClick={() =>
                    setRows((all) => all.map((r, i) => (i === li ? [...r, { batch: "", quantity: "" }] : r)))
                  }
                >
                  + Send from another batch
                </button>
              )}
              {mixed && (
                <p className="text-xs text-amber-700">
                  Mixing batches: the shop will get rolls that may differ slightly in shade. Keep them labelled.
                </p>
              )}
              {total === 0 && <p className="text-danger text-xs">None in stock here — this item can&apos;t be sent.</p>}
            </li>
          );
        })}
      </ul>
      <input
        className="input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note for the receiver (optional), e.g. driver name or vehicle"
        aria-label="Dispatch note"
      />
      <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>
        {pending ? "Working…" : "Dispatch (stock leaves now)"}
      </button>
    </section>
  );
}

export type ReceiveItem = {
  id: string;
  label: string;
  code: string;
  batch: string;
  unit: string;
  allows_decimal: boolean;
  dispatched: number;
};

export function ReceiveForm({
  transferId,
  items,
  toName,
}: {
  transferId: string;
  items: ReceiveItem[];
  toName: string;
}) {
  const [values, setValues] = useState(() => items.map((i) => ({ received: formatQty(i.dispatched), reason: "" })));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const short = items.filter((item, i) => Number(values[i].received) < item.dispatched);
    const missingReason = short.find((item) => !values[items.indexOf(item)].reason.trim());
    if (missingReason) return setError(`Say why fewer ${missingReason.label} arrived than were sent.`);
    const message = short.length
      ? `Confirm with ${short.length} shortage${short.length === 1 ? "" : "s"}? A manager will be asked to look into it.`
      : `Confirm everything arrived? Stock will be added to ${toName}.`;
    if (!confirm(message)) return;
    startTransition(async () => {
      const result = await receiveTransfer(
        transferId,
        items.map((item, i) => ({
          item_id: item.id,
          received_quantity: values[i].received || "0",
          reason: values[i].reason || undefined,
        })),
      );
      if (result?.error) setError(result.error);
    });
  }

  return (
    <section className="card space-y-4 p-4">
      <div>
        <h2 className="font-semibold">Confirm what arrived</h2>
        <p className="text-muted text-sm">
          Count the items. If anything is missing or broken, enter what arrived in good condition.
        </p>
      </div>
      <ErrorBox error={error} />
      <ul className="divide-border divide-y">
        {items.map((item, i) => {
          const short = Number(values[i].received) < item.dispatched;
          return (
            <li key={item.id} className="flex flex-wrap items-end gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.label}</p>
                <p className="text-muted text-xs">
                  <span className="font-mono">{item.code}</span>
                  {item.batch && ` · batch ${item.batch}`} · sent {formatQty(item.dispatched)} {item.unit}
                </p>
              </div>
              <label className="w-24">
                <span className="label text-xs">Arrived</span>
                <input
                  className={`input text-right tabular-nums ${short ? "border-amber-500" : ""}`}
                  inputMode={item.allows_decimal ? "decimal" : "numeric"}
                  value={values[i].received}
                  onChange={(e) =>
                    setValues((v) => v.map((x, j) => (j === i ? { ...x, received: e.target.value } : x)))
                  }
                />
              </label>
              {short && (
                <label className="w-56">
                  <span className="label text-xs">What happened?</span>
                  <input
                    className="input"
                    value={values[i].reason}
                    placeholder="e.g. 1 broken in the van"
                    onChange={(e) =>
                      setValues((v) => v.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))
                    }
                  />
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>
        {pending ? "Working…" : "Confirm received"}
      </button>
    </section>
  );
}

export function CancelButton({ transferId }: { transferId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <button
        type="button"
        className="btn btn-secondary text-danger"
        disabled={pending}
        onClick={() => {
          const reason = prompt("Why cancel this request?");
          if (reason === null) return;
          startTransition(async () => {
            const result = await cancelTransfer(transferId, reason);
            if (result.error) setError(result.error);
          });
        }}
      >
        Cancel request
      </button>
      {error && <p className="text-danger mt-1 text-xs">{error}</p>}
    </div>
  );
}

export function ResolveShortage({ transferId }: { transferId: string }) {
  const [text, setText] = useState("Lost in transit");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <section className="card border-danger/40 space-y-3 p-4">
      <h2 className="font-semibold">Resolve shortage</h2>
      <p className="text-muted text-sm">
        Stock figures are already correct — only what arrived was added. Record what happened to the missing items.
      </p>
      <ErrorBox error={error} />
      <input className="input" value={text} onChange={(e) => setText(e.target.value)} aria-label="Resolution" />
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await resolveShortage(transferId, text);
            if (result.error) setError(result.error);
          })
        }
      >
        {pending ? "Saving…" : "Mark as resolved"}
      </button>
    </section>
  );
}
