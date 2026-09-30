import { formatDate, formatDateTime } from "@/lib/dates";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getStaffNames } from "@/lib/staff-names";
import { formatMoney, toMoneyInput } from "@/lib/money";
import { formatQty, getActiveLocations, isManager } from "../../data";
import { ReceiptForm } from "../receipt-form";

export default async function DeliveryPage({ params, searchParams }: PageProps<"/app/stock/deliveries/[id]">) {
  const staff = await requireStaff(["owner", "manager", "warehouse"]);
  const { id } = await params;
  const { posted, saved } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data: receipt }, { data: costs }, locations, { currency }] = await Promise.all([
    supabase
      .from("receipts")
      .select(
        `id, number, status, location_id, supplier_name, supplier_reference, received_on, note, created_at, posted_at,
         created_by, posted_by, locations(name),
         receipt_lines(id, batch, quantity, sort_order,
           skus(id, code, variant_label, products(name, track_batches, units(abbreviation, allows_decimal))))`,
      )
      .eq("id", id)
      .order("sort_order", { referencedTable: "receipt_lines" })
      .maybeSingle(),
    supabase.from("receipt_costs").select("sku_id, unit_cost_kobo").eq("receipt_id", id),
    getActiveLocations(),
    getBusinessSettings(),
  ]);
  if (!receipt) notFound();

  const manager = isManager(staff.role);
  const names = await getStaffNames([receipt.created_by, receipt.posted_by]);
  const cost = new Map(costs?.map((c) => [c.sku_id, c.unit_cost_kobo]));
  const lines = receipt.receipt_lines.map((l) => ({
    sku: {
      id: l.skus.id,
      code: l.skus.code,
      variant_label: l.skus.variant_label,
      product_name: l.skus.products.name,
      unit: l.skus.products.units.abbreviation,
      allows_decimal: l.skus.products.units.allows_decimal,
      track_batches: l.skus.products.track_batches,
    },
    batch: l.batch,
    quantity: formatQty(Number(l.quantity)),
    unit_cost: toMoneyInput(cost.get(l.skus.id)),
  }));

  const header = (
    <>
      <Link href="/app/stock/deliveries" className="text-muted text-sm hover:underline">
        ← Deliveries
      </Link>
      <h2 className="text-xl font-semibold">
        {receipt.number} <span className="text-muted text-base font-normal capitalize">· {receipt.status}</span>
      </h2>
      {(posted || saved) && (
        <p role="status" className="bg-success/10 text-success rounded-md px-3 py-2 text-sm">
          {posted ? "Delivery posted — stock has been added." : "Draft saved."}
        </p>
      )}
    </>
  );

  if (receipt.status === "draft") {
    const warehouses = locations.filter((l) => l.kind === "warehouse" && (manager || l.id === staff.locationId));
    return (
      <div className="max-w-3xl space-y-4">
        {header}
        <ReceiptForm
          key={receipt.id + lines.length}
          initial={{
            id: receipt.id,
            location_id: receipt.location_id,
            supplier_name: receipt.supplier_name ?? "",
            supplier_reference: receipt.supplier_reference ?? "",
            received_on: receipt.received_on,
            note: receipt.note ?? "",
            lines,
          }}
          warehouses={warehouses}
          canCost={manager}
          currency={currency}
        />
      </div>
    );
  }

  const totalCost = manager ? lines.reduce((sum, l) => sum + (cost.get(l.sku.id) ?? 0) * Number(l.quantity), 0) : null;

  return (
    <div className="max-w-3xl space-y-4">
      {header}
      <dl className="card grid gap-3 p-4 text-sm sm:grid-cols-2">
        <Detail label="Warehouse" value={receipt.locations.name} />
        <Detail label="Date received" value={formatDate(receipt.received_on)} />
        <Detail label="Supplier" value={receipt.supplier_name} />
        <Detail label="Invoice / waybill" value={receipt.supplier_reference} />
        <Detail label="Recorded by" value={receipt.created_by ? names.get(receipt.created_by) : null} />
        {receipt.posted_at && (
          <Detail
            label="Posted"
            value={`${formatDateTime(receipt.posted_at)} by ${(receipt.posted_by && names.get(receipt.posted_by)) || "—"}`}
          />
        )}
        {receipt.note && <Detail label="Note" value={receipt.note} />}
      </dl>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted border-border border-b text-left">
            <tr>
              <th className="p-3 font-medium">Item</th>
              <th className="p-3 font-medium">Batch</th>
              <th className="p-3 text-right font-medium">Quantity</th>
              {manager && <th className="p-3 text-right font-medium">Unit cost</th>}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="p-3">
                  {l.sku.product_name}
                  {l.sku.variant_label && ` · ${l.sku.variant_label}`}
                  <span className="text-muted ml-2 font-mono text-xs">{l.sku.code}</span>
                </td>
                <td className="p-3">{l.batch || "–"}</td>
                <td className="p-3 text-right tabular-nums">
                  {l.quantity} {l.sku.unit}
                </td>
                {manager && (
                  <td className="p-3 text-right tabular-nums">
                    {cost.has(l.sku.id) ? formatMoney(cost.get(l.sku.id)!, currency) : "–"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {totalCost !== null && totalCost > 0 && (
            <tfoot className="border-border border-t font-medium">
              <tr>
                <td className="p-3" colSpan={3}>
                  Total cost
                </td>
                <td className="p-3 text-right tabular-nums">{formatMoney(totalCost, currency)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {receipt.status === "posted" && (
        <Link href={`/app/stock/labels?receipt=${receipt.id}`} className="btn btn-primary">
          Print labels for this delivery
        </Link>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-muted text-xs">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
