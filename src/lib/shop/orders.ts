import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Online orders as the website sees them. Customers have no accounts: an order is reached through
// the unguessable token in its link, and payments are matched by their reference.

/** Releases stock held for orders whose time to pay has run out. Cheap; called before reading stock. */
export async function expireUnpaidOrders() {
  const { error } = await createAdminClient().rpc("expire_online_orders");
  if (error) throw error;
}

/** Gives up an order that hasn't been paid for and frees its stock. Does nothing to paid orders. */
export async function releaseUnpaidOrder(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("online_orders")
    .update({ status: "expired" })
    .eq("token", token)
    .eq("status", "pending_payment")
    .select("id");
  if (error) throw error;
  if (data.length === 0) return;
  const { error: holdError } = await admin.from("stock_holds").delete().eq("order_id", data[0].id);
  if (holdError) throw holdError;
}

/** Records a confirmed payment and turns the order into a sale. Safe to call more than once. */
export async function confirmPayment(reference: string, amountKobo: number) {
  const { data, error } = await createAdminClient().rpc("mark_order_paid", {
    p_reference: reference,
    p_amount_kobo: amountKobo,
  });
  if (error) throw error;
  return data as { token: string; status: string; already: boolean };
}

export async function getOrderForPayment(reference: string) {
  const { data, error } = await createAdminClient()
    .from("online_orders")
    .select("number, token, status, total_kobo, expires_at, customer_name")
    .eq("payment_reference", reference)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getOrderByToken(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const { data, error } = await createAdminClient()
    .from("online_orders")
    .select(
      `number, status, fulfilment, customer_name, delivery_address, delivery_area, delivery_fee_kobo, subtotal_kobo,
       total_kobo, paid_at, expires_at, payment_url, refunded_at, created_at,
       locations(name, public_name, address, phone),
       sales(number, receipt_token, fulfilment_status),
       online_order_lines(quantity, unit_price_kobo, line_total_kobo, sort_order,
         skus(variant_label, products(name, slug, units(abbreviation))))`,
    )
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type CustomerOrder = NonNullable<Awaited<ReturnType<typeof getOrderByToken>>>;
