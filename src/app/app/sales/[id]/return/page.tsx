import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { ReturnForm } from "./return-form";

export default async function ReturnPage({ params }: PageProps<"/app/sales/[id]/return">) {
  await requireStaff(["owner", "manager", "cashier"]);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: sale } = await supabase
    .from("sales")
    .select(
      `id, number, created_at, location_id, locations(name),
       sale_lines(id, quantity, returned_quantity, unit_price_kobo, batch, sort_order,
         skus(code, variant_label, products(name, units(abbreviation, allows_decimal))))`,
    )
    .eq("id", id)
    .order("sort_order", { referencedTable: "sale_lines" })
    .maybeSingle();
  if (!sale) notFound();
  const [{ currency, receipt_footer }, { data: shift }] = await Promise.all([
    getBusinessSettings(),
    supabase.from("shifts").select("id").eq("location_id", sale.location_id).eq("status", "open").maybeSingle(),
  ]);

  return (
    <div className="max-w-3xl space-y-4">
      <Link href={`/app/sales/${sale.id}`} className="text-muted text-sm hover:underline">
        ← {sale.number}
      </Link>
      <h2 className="text-xl font-semibold">Return items</h2>
      <p className="text-muted text-sm">
        Sold {formatDateTime(sale.created_at)} at {sale.locations.name}.
        {receipt_footer && <> Policy on receipts: “{receipt_footer}”</>}
      </p>
      {!shift ? (
        <p className="card p-6 text-sm">
          Open the till at {sale.locations.name} first — refunds come out of the till session.
        </p>
      ) : (
        <ReturnForm
          saleId={sale.id}
          currency={currency}
          lines={sale.sale_lines
            .filter((l) => Number(l.returned_quantity) < Number(l.quantity))
            .map((l) => ({
              id: l.id,
              label: `${l.skus.products.name}${l.skus.variant_label ? ` · ${l.skus.variant_label}` : ""}`,
              code: l.skus.code,
              unit: l.skus.products.units.abbreviation,
              allows_decimal: l.skus.products.units.allows_decimal,
              returnable: Number(l.quantity) - Number(l.returned_quantity),
              unit_price_kobo: l.unit_price_kobo,
            }))}
        />
      )}
    </div>
  );
}
