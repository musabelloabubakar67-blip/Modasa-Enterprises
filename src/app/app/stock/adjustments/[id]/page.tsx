import { formatDateTime } from "@/lib/dates";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStaffNames } from "@/lib/staff-names";
import { ADJUSTMENT_LABELS, formatQty, isManager } from "../../data";
import { ReviewPanel } from "./review-panel";

const STATUS_STYLES = {
  pending: "bg-accent/10 text-accent",
  approved: "bg-success/10 text-success",
  rejected: "bg-danger/10 text-danger",
} as const;

export default async function AdjustmentPage({ params, searchParams }: PageProps<"/app/stock/adjustments/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const { submitted } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: adj } = await supabase
    .from("adjustments")
    .select(
      `id, number, kind, status, note, created_at, created_by, reviewed_by, reviewed_at, review_note, location_id,
       locations(name),
       adjustment_lines(id, batch, quantity, system_quantity, reason, sort_order,
         skus(id, code, variant_label, products(name, units(abbreviation))))`,
    )
    .eq("id", id)
    .order("sort_order", { referencedTable: "adjustment_lines" })
    .maybeSingle();
  if (!adj) notFound();

  const names = await getStaffNames([adj.created_by, adj.reviewed_by]);
  const manager = isManager(staff.role);
  const isCount = adj.kind !== "damage";

  // For pending counts, show what the stock is now too, so the reviewer can spot sales since the count.
  const current = new Map<string, number>();
  if (adj.status === "pending" && isCount) {
    const { data } = await supabase
      .from("stock_levels")
      .select("sku_id, batch, quantity")
      .eq("location_id", adj.location_id)
      .in(
        "sku_id",
        adj.adjustment_lines.map((l) => l.skus.id),
      );
    data?.forEach((l) => current.set(`${l.sku_id}|${l.batch}`, Number(l.quantity)));
  }

  return (
    <div className="max-w-4xl space-y-4">
      <Link href="/app/stock/adjustments" className="text-muted text-sm hover:underline">
        ← Adjustments
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">
          {ADJUSTMENT_LABELS[adj.kind]} · {adj.locations.name}
        </h2>
        <span className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[adj.status]}`}>
          {adj.status === "pending" ? "Waiting for approval" : adj.status}
        </span>
      </div>
      {submitted && (
        <p role="status" className="bg-success/10 text-success rounded-md px-3 py-2 text-sm">
          {adj.status === "pending" ? "Submitted. A manager will review it." : "Done — stock has been updated."}
        </p>
      )}
      <p className="text-muted text-sm">
        {adj.number} · by {(adj.created_by && names.get(adj.created_by)) ?? "System"} on{" "}
        {formatDateTime(adj.created_at)}
        {adj.note && <> · “{adj.note}”</>}
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted border-border border-b text-left">
            <tr>
              <th className="p-3 font-medium">Item</th>
              <th className="p-3 font-medium">Batch</th>
              {isCount ? (
                <>
                  <th className="p-3 text-right font-medium">System said</th>
                  <th className="p-3 text-right font-medium">Counted</th>
                  <th className="p-3 text-right font-medium">Difference</th>
                  {current.size > 0 && <th className="p-3 text-right font-medium">Now</th>}
                </>
              ) : (
                <>
                  <th className="p-3 text-right font-medium">Write off</th>
                  <th className="p-3 font-medium">Reason</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {adj.adjustment_lines.map((l) => {
              const diff = Number(l.quantity) - Number(l.system_quantity);
              const unit = l.skus.products.units.abbreviation;
              return (
                <tr key={l.id}>
                  <td className="p-3">
                    <Link href={`/app/stock/${l.skus.id}`} className="hover:underline">
                      {l.skus.products.name}
                      {l.skus.variant_label && ` · ${l.skus.variant_label}`}
                    </Link>
                    <span className="text-muted ml-2 font-mono text-xs">{l.skus.code}</span>
                  </td>
                  <td className="p-3">{l.batch || "–"}</td>
                  {isCount ? (
                    <>
                      <td className="p-3 text-right tabular-nums">{formatQty(Number(l.system_quantity))}</td>
                      <td className="p-3 text-right tabular-nums">
                        {formatQty(Number(l.quantity))} {unit}
                      </td>
                      <td
                        className={`p-3 text-right font-medium tabular-nums ${diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-muted"}`}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff === 0 ? "No change" : formatQty(diff)}
                      </td>
                      {current.size > 0 && (
                        <td className="text-muted p-3 text-right tabular-nums">
                          {formatQty(current.get(`${l.skus.id}|${l.batch}`) ?? 0)}
                        </td>
                      )}
                    </>
                  ) : (
                    <>
                      <td className="text-danger p-3 text-right font-medium tabular-nums">
                        −{formatQty(Number(l.quantity))} {unit}
                      </td>
                      <td className="p-3">{l.reason}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {isCount && adj.status === "pending" && (
        <p className="text-muted text-xs">
          On approval, only the difference is applied, so sales made since the count aren&apos;t undone.
        </p>
      )}

      {adj.status !== "pending" && (
        <p className="text-sm">
          {adj.status === "approved" ? "Approved" : "Rejected"} by{" "}
          {(adj.reviewed_by && names.get(adj.reviewed_by)) ?? "—"}
          {adj.reviewed_at && ` on ${formatDateTime(adj.reviewed_at)}`}
          {adj.review_note && <> · “{adj.review_note}”</>}
        </p>
      )}

      {adj.status === "pending" && manager && <ReviewPanel id={adj.id} />}
    </div>
  );
}
