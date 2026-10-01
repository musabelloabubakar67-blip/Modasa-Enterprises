import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const RECEIPT_SELECT = `id, number, created_at, subtotal_kobo, delivery_fee_kobo, total_kobo, vat_rate, vat_kobo,
  fulfilment, fulfilment_status, delivery_address, delivery_area, delivery_date, cashier_id,
  locations(name, address, phone), customers(name, phone),
  sale_lines(id, quantity, batch, list_price_kobo, unit_price_kobo, line_total_kobo, returned_quantity, sort_order,
    skus(code, variant_label, products(name, units(abbreviation)))),
  sale_payments(method, amount_kobo, tendered_kobo),
  returns(number, refund_kobo, refund_method, created_at)`;

/** A sale as the signed-in staff member can see it (row-level security applies). */
export async function getReceiptById(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales")
    .select(RECEIPT_SELECT)
    .eq("id", id)
    .order("sort_order", { referencedTable: "sale_lines" })
    .maybeSingle();
  return data;
}

/**
 * A sale looked up by its unguessable receipt token, for the customer's online receipt. Uses the
 * service role because customers aren't signed in; only receipt fields are selected.
 */
export async function getReceiptByToken(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const { data } = await createAdminClient()
    .from("sales")
    .select(RECEIPT_SELECT)
    .eq("receipt_token", token)
    .order("sort_order", { referencedTable: "sale_lines" })
    .maybeSingle();
  return data;
}

export type Receipt = NonNullable<Awaited<ReturnType<typeof getReceiptById>>>;
