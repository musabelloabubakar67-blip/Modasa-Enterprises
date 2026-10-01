import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatQty } from "@/lib/quantity";
import { getStaffNames } from "@/lib/staff-names";
import { createClient } from "@/lib/supabase/server";
import { getSaleShare } from "../actions";
import { FulfilmentButtons } from "../fulfilment-buttons";

const METHOD = { cash: "Cash", card: "POS card", transfer: "Bank transfer" } as const;
const STATUS = { pending: "Waiting", out_for_delivery: "Out for delivery", completed: "Done" } as const;

export default async function SalePage({ params, searchParams }: PageProps<"/app/sales/[id]">) {
  await requireStaff(["owner", "manager", "cashier"]);
  const { id } = await params;
  const { returned } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: sale } = await supabase
    .from("sales")
    .select(
      `id, number, created_at, cashier_id, subtotal_kobo, delivery_fee_kobo, total_kobo, vat_kobo, vat_rate, note,
       fulfilment, fulfilment_status, fulfilment_updated_at, delivery_address, delivery_area, delivery_date,
       locations(name), customers(name, phone, email),
       sale_lines(id, quantity, batch, unit_price_kobo, list_price_kobo, line_total_kobo, returned_quantity, sort_order,
         skus(id, code, variant_label, products(name, units(abbreviation)))),
       sale_payments(method, amount_kobo, tendered_kobo, reference),
       returns(id, number, created_at, refund_kobo, refund_method, reason, created_by,
         return_lines(quantity, condition, sale_line_id))`,
    )
    .eq("id", id)
    .order("sort_order", { referencedTable: "sale_lines" })
    .maybeSingle();
  if (!sale) notFound();

  const [{ currency }, names, share] = await Promise.all([
    getBusinessSettings(),
    getStaffNames([sale.cashier_id, ...sale.returns.map((r) => r.created_by)]),
    getSaleShare(sale.id),
  ]);
  const money = (k: number) => formatMoney(k, currency);
  const canReturn = sale.sale_lines.some((l) => Number(l.returned_quantity) < Number(l.quantity));

  return (
    <div className="space-y-4">
      <Link href="/app/sales" className="text-muted text-sm hover:underline">
        ← Sales
      </Link>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">
          {sale.number} <span className="text-muted text-base font-normal">· {sale.locations.name}</span>
        </h2>
        <p className="text-xl font-semibold tabular-nums">{money(sale.total_kobo)}</p>
      </div>
      {returned && (
        <p role="status" className="bg-success/10 text-success rounded-md px-3 py-2 text-sm">
          Return recorded. Give the customer their refund.
        </p>
      )}
      <p className="text-muted text-sm">
        {formatDateTime(sale.created_at)} · served by {(sale.cashier_id && names.get(sale.cashier_id)) ?? "—"}
        {sale.customers && (
          <>
            {" "}
            · {sale.customers.name} {sale.customers.phone}
          </>
        )}
        {sale.note && <> · “{sale.note}”</>}
      </p>

      <div className="flex flex-wrap gap-2">
        <a href={`/app/sales/${sale.id}/receipt?print=1`} target="_blank" rel="noopener" className="btn btn-secondary">
          Print receipt
        </a>
        {share?.whatsapp_url && (
          <a href={share.whatsapp_url} target="_blank" rel="noopener" className="btn btn-secondary">
            Send on WhatsApp
          </a>
        )}
        {canReturn && (
          <Link href={`/app/sales/${sale.id}/return`} className="btn btn-secondary">
            Return items
          </Link>
        )}
      </div>

      {sale.fulfilment !== "taken" && (
        <section className="card space-y-2 p-4">
          <h3 className="font-semibold">
            {sale.fulfilment === "delivery" ? "Delivery" : "Collection"} · {STATUS[sale.fulfilment_status]}
          </h3>
          {sale.fulfilment === "delivery" && (
            <p className="text-sm">
              {sale.delivery_address}
              {sale.delivery_area && ` (${sale.delivery_area})`}
              {sale.delivery_date && ` · ${formatDate(sale.delivery_date)}`}
            </p>
          )}
          <FulfilmentButtons saleId={sale.id} fulfilment={sale.fulfilment} status={sale.fulfilment_status} />
        </section>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted border-border border-b text-left">
            <tr>
              <th className="p-3 font-medium">Item</th>
              <th className="p-3 text-right font-medium">Qty</th>
              <th className="p-3 text-right font-medium">Price</th>
              <th className="p-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {sale.sale_lines.map((l) => (
              <tr key={l.id}>
                <td className="p-3">
                  {l.skus.products.name}
                  {l.skus.variant_label && ` · ${l.skus.variant_label}`}
                  <span className="text-muted ml-2 font-mono text-xs">{l.skus.code}</span>
                  {l.batch && <span className="text-muted ml-2 text-xs">batch {l.batch}</span>}
                  {Number(l.returned_quantity) > 0 && (
                    <p className="text-danger text-xs">{formatQty(Number(l.returned_quantity))} returned</p>
                  )}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {formatQty(Number(l.quantity))} {l.skus.products.units.abbreviation}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {l.unit_price_kobo < l.list_price_kobo && (
                    <span className="text-muted mr-1 text-xs line-through">{money(l.list_price_kobo)}</span>
                  )}
                  {money(l.unit_price_kobo)}
                </td>
                <td className="p-3 text-right tabular-nums">{money(l.line_total_kobo)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-border border-t">
            {sale.delivery_fee_kobo > 0 && (
              <tr>
                <td className="p-3" colSpan={3}>
                  Delivery fee
                </td>
                <td className="p-3 text-right tabular-nums">{money(sale.delivery_fee_kobo)}</td>
              </tr>
            )}
            <tr className="font-semibold">
              <td className="p-3" colSpan={3}>
                Total
                {sale.vat_kobo > 0 && (
                  <span className="text-muted ml-2 text-xs font-normal">
                    incl. VAT {Number(sale.vat_rate)}%: {money(sale.vat_kobo)}
                  </span>
                )}
              </td>
              <td className="p-3 text-right tabular-nums">{money(sale.total_kobo)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <section className="card p-4 text-sm">
        <h3 className="mb-2 font-semibold">Payments</h3>
        <ul className="space-y-1">
          {sale.sale_payments.map((p, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>
                {METHOD[p.method]}
                {p.reference && <span className="text-muted"> · {p.reference}</span>}
                {p.tendered_kobo && p.tendered_kobo > p.amount_kobo && (
                  <span className="text-muted">
                    {" "}
                    · received {money(p.tendered_kobo)}, change {money(p.tendered_kobo - p.amount_kobo)}
                  </span>
                )}
              </span>
              <span className="tabular-nums">{money(p.amount_kobo)}</span>
            </li>
          ))}
        </ul>
      </section>

      {sale.returns.length > 0 && (
        <section className="card p-4 text-sm">
          <h3 className="mb-2 font-semibold">Returns</h3>
          <ul className="space-y-2">
            {sale.returns.map((r) => (
              <li key={r.id}>
                <div className="flex justify-between gap-2">
                  <span>
                    {r.number} · {formatDateTime(r.created_at)} · {(r.created_by && names.get(r.created_by)) ?? "—"}
                  </span>
                  <span className="text-danger tabular-nums">
                    −{money(r.refund_kobo)} ({METHOD[r.refund_method]})
                  </span>
                </div>
                <p className="text-muted">
                  “{r.reason}” ·{" "}
                  {r.return_lines
                    .map((rl) => {
                      const line = sale.sale_lines.find((l) => l.id === rl.sale_line_id);
                      return `${formatQty(Number(rl.quantity))} × ${line?.skus.products.name ?? "item"}${rl.condition === "damaged" ? " (damaged)" : ""}`;
                    })
                    .join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
