import "server-only";
import { createClient } from "@/lib/supabase/server";

/** A transfer with its requested lines and dispatched items, for the detail page and dispatch note. */
export async function getTransfer(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transfers")
    .select(
      `id, number, status, note, dispatch_note, from_location_id, to_location_id,
       requested_by, requested_at, dispatched_by, dispatched_at, received_by, received_at,
       cancelled_by, cancelled_at, cancel_reason,
       has_shortage, shortage_resolution, shortage_resolved_by, shortage_resolved_at,
       from:locations!transfers_from_location_id_fkey(name, address, phone),
       to:locations!transfers_to_location_id_fkey(name, address, phone),
       transfer_lines(sku_id, requested_quantity, sort_order,
         skus(code, variant_label, products(name, track_batches, units(abbreviation, allows_decimal)))),
       transfer_items(id, sku_id, batch, dispatched_quantity, received_quantity, shortage_reason, sort_order,
         skus(code, variant_label, products(name, units(abbreviation, allows_decimal))))`,
    )
    .eq("id", id)
    .order("sort_order", { referencedTable: "transfer_lines" })
    .order("sort_order", { referencedTable: "transfer_items" })
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type Transfer = NonNullable<Awaited<ReturnType<typeof getTransfer>>>;

export const itemLabel = (s: { variant_label: string | null; products: { name: string } }) =>
  s.variant_label ? `${s.products.name} · ${s.variant_label}` : s.products.name;
