import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { formatQty } from "@/lib/quantity";
import { getStaffNames } from "@/lib/staff-names";
import { createClient } from "@/lib/supabase/server";
import { isManager } from "../../stock/data";
import { STATUS_LABELS, STATUS_STYLES } from "../labels";
import { getTransfer, itemLabel } from "./data";
import { CancelButton, DispatchForm, ReceiveForm, ResolveShortage, type DispatchLine } from "./panels";

export default async function TransferPage({ params, searchParams }: PageProps<"/app/transfers/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const flags = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const t = await getTransfer(id);
  if (!t) notFound();

  const manager = isManager(staff.role);
  const atSource = manager || staff.locationId === t.from_location_id;
  const atDest = manager || staff.locationId === t.to_location_id;
  const names = await getStaffNames([
    t.requested_by,
    t.dispatched_by,
    t.received_by,
    t.cancelled_by,
    t.shortage_resolved_by,
  ]);
  const who = (id: string | null) => (id && names.get(id)) || "—";

  // For dispatching: what the source has of each requested item, per batch.
  let dispatchLines: DispatchLine[] = [];
  if (t.status === "requested" && atSource) {
    const supabase = await createClient();
    const { data: levels } = await supabase
      .from("stock_levels")
      .select("sku_id, batch, quantity")
      .eq("location_id", t.from_location_id)
      .in(
        "sku_id",
        t.transfer_lines.map((l) => l.sku_id),
      );
    dispatchLines = t.transfer_lines.map((l) => ({
      sku_id: l.sku_id,
      label: itemLabel(l.skus),
      code: l.skus.code,
      unit: l.skus.products.units.abbreviation,
      allows_decimal: l.skus.products.units.allows_decimal,
      track_batches: l.skus.products.track_batches,
      requested: Number(l.requested_quantity),
      batches: (levels ?? [])
        .filter((x) => x.sku_id === l.sku_id)
        .map((x) => ({ batch: x.batch, quantity: Number(x.quantity) })),
    }));
  }

  const banner = flags.created
    ? "Transfer requested. The sending location will see it in their list."
    : flags.dispatched
      ? "Dispatched — the stock is now in transit."
      : flags.received
        ? "Received — the stock has been added."
        : null;

  return (
    <div className="max-w-4xl space-y-4">
      <Link href="/app/transfers" className="text-muted text-sm hover:underline">
        ← Transfers
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">
          {t.from.name} → {t.to.name}
        </h1>
        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[t.status]}`}>{STATUS_LABELS[t.status]}</span>
        {t.has_shortage && (
          <span className="bg-danger/10 text-danger rounded px-2 py-0.5 text-xs">
            {t.shortage_resolved_at ? "Shortage resolved" : "Shortage"}
          </span>
        )}
      </div>
      {banner && (
        <p role="status" className="bg-success/10 text-success rounded-md px-3 py-2 text-sm">
          {banner}
        </p>
      )}

      <ol className="card grid gap-3 p-4 text-sm sm:grid-cols-3">
        <Step done label="Requested" detail={`${formatDateTime(t.requested_at)} · ${who(t.requested_by)}`} />
        <Step
          done={!!t.dispatched_at}
          label="Dispatched"
          detail={t.dispatched_at ? `${formatDateTime(t.dispatched_at)} · ${who(t.dispatched_by)}` : "Waiting"}
        />
        {t.status === "cancelled" ? (
          <Step
            done
            label="Cancelled"
            detail={`${t.cancelled_at ? formatDateTime(t.cancelled_at) : ""} · ${who(t.cancelled_by)}${t.cancel_reason ? ` · “${t.cancel_reason}”` : ""}`}
          />
        ) : (
          <Step
            done={!!t.received_at}
            label="Received"
            detail={t.received_at ? `${formatDateTime(t.received_at)} · ${who(t.received_by)}` : "Waiting"}
          />
        )}
      </ol>
      <p className="text-muted text-sm">
        {t.number}
        {t.note && <> · “{t.note}”</>}
        {t.dispatch_note && <> · Dispatch note: “{t.dispatch_note}”</>}
      </p>

      {t.status === "requested" && atSource && (
        <DispatchForm transferId={t.id} lines={dispatchLines} fromName={t.from.name} />
      )}

      {t.status === "dispatched" && atDest && (
        <ReceiveForm
          transferId={t.id}
          toName={t.to.name}
          items={t.transfer_items.map((i) => ({
            id: i.id,
            label: itemLabel(i.skus),
            code: i.skus.code,
            batch: i.batch,
            unit: i.skus.products.units.abbreviation,
            allows_decimal: i.skus.products.units.allows_decimal,
            dispatched: Number(i.dispatched_quantity),
          }))}
        />
      )}

      {t.has_shortage && !t.shortage_resolved_at && manager && <ResolveShortage transferId={t.id} />}
      {t.shortage_resolved_at && (
        <p className="text-sm">
          Shortage resolved by {who(t.shortage_resolved_by)} on {formatDateTime(t.shortage_resolved_at)}: “
          {t.shortage_resolution}”
        </p>
      )}

      {/* Read-only summary once there's nothing for this person to do on the form above. */}
      {!(t.status === "requested" && atSource) && !(t.status === "dispatched" && atDest) && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted border-border border-b text-left">
              <tr>
                <th className="p-3 font-medium">Item</th>
                <th className="p-3 text-right font-medium">Requested</th>
                {t.transfer_items.length > 0 && (
                  <>
                    <th className="p-3 font-medium">Batch</th>
                    <th className="p-3 text-right font-medium">Sent</th>
                    <th className="p-3 text-right font-medium">Arrived</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {t.transfer_lines.map((l) => {
                const items = t.transfer_items.filter((i) => i.sku_id === l.sku_id);
                const unit = l.skus.products.units.abbreviation;
                const rows = items.length ? items : [null];
                return rows.map((item, k) => (
                  <tr key={`${l.sku_id}-${k}`}>
                    {k === 0 && (
                      <>
                        <td className="p-3" rowSpan={rows.length}>
                          {itemLabel(l.skus)}
                          <span className="text-muted ml-2 font-mono text-xs">{l.skus.code}</span>
                        </td>
                        <td className="p-3 text-right tabular-nums" rowSpan={rows.length}>
                          {formatQty(Number(l.requested_quantity))} {unit}
                        </td>
                      </>
                    )}
                    {t.transfer_items.length > 0 && (
                      <>
                        <td className="p-3">{item ? item.batch || "–" : ""}</td>
                        <td className="p-3 text-right tabular-nums">
                          {item ? formatQty(Number(item.dispatched_quantity)) : "Not sent"}
                        </td>
                        <td
                          className={`p-3 text-right tabular-nums ${item && item.received_quantity !== null && Number(item.received_quantity) < Number(item.dispatched_quantity) ? "text-danger font-medium" : ""}`}
                          title={item?.shortage_reason ?? undefined}
                        >
                          {item?.received_quantity !== null && item?.received_quantity !== undefined
                            ? formatQty(Number(item.received_quantity))
                            : "–"}
                          {item?.shortage_reason && <p className="text-xs font-normal">{item.shortage_reason}</p>}
                        </td>
                      </>
                    )}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {t.status !== "requested" && t.status !== "cancelled" && (
          <Link href={`/app/transfers/${t.id}/note`} className="btn btn-secondary">
            Print dispatch note
          </Link>
        )}
        {t.status === "requested" && (atSource || atDest) && <CancelButton transferId={t.id} />}
      </div>
    </div>
  );
}

function Step({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <li className="flex gap-2">
      <span
        className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${done ? "border-success bg-success" : "border-border"}`}
        aria-hidden="true"
      />
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-muted text-xs">{detail}</p>
      </div>
    </li>
  );
}
