import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { expireUnpaidOrders } from "@/lib/shop/orders";
import { createClient } from "@/lib/supabase/server";
import { TONE_STYLES, needsAttention, orderLabel } from "./status";

export default async function OnlineOrdersPage({ searchParams }: PageProps<"/app/online-orders">) {
  await requireStaff(["owner", "manager", "cashier"]);
  const showAll = (await searchParams).show === "all";
  await expireUnpaidOrders();

  const supabase = await createClient();
  // Row-level security limits cashiers to their own shop's orders.
  let query = supabase
    .from("online_orders")
    .select(
      "id, number, status, fulfilment, customer_name, customer_phone, total_kobo, paid_at, attention, created_at, locations(name), sales(fulfilment_status), online_order_lines(quantity)",
    )
    .order("created_at", { ascending: false })
    .limit(showAll ? 200 : 100);
  if (!showAll) query = query.in("status", ["pending_payment", "paid", "awaiting_stock", "confirmed", "cancelled"]);
  const [{ data, error }, { currency }] = await Promise.all([query, getBusinessSettings()]);
  if (error) throw error;

  const orders = data
    .map((o) => ({ ...o, handover: o.sales?.fulfilment_status ?? null }))
    // The short list leaves out what is finished: handed over, or cancelled with nothing to refund.
    .filter((o) => showAll || !(o.status === "confirmed" && o.handover === "completed"))
    .filter((o) => showAll || !(o.status === "cancelled" && !o.paid_at))
    .sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)));

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Online orders</h1>
          <p className="text-muted mt-1 text-sm">
            Orders placed and paid for on the website. Once a sale is created, hand it over from{" "}
            <Link href="/app/sales/pending" className="text-accent hover:underline">
              Collection &amp; delivery
            </Link>
            .
          </p>
        </div>
        <Link href={showAll ? "/app/online-orders" : "/app/online-orders?show=all"} className="btn btn-secondary">
          {showAll ? "Show open orders" : "Show all orders"}
        </Link>
      </div>

      <ul className="mt-6 space-y-3">
        {orders.length === 0 && (
          <li className="card text-muted p-6 text-center text-sm">
            {showAll ? "No online orders yet." : "No open online orders."}
          </li>
        )}
        {orders.map((o) => {
          const label = orderLabel(o);
          const items = o.online_order_lines.reduce((n, l) => n + Number(l.quantity), 0);
          return (
            <li key={o.id}>
              <Link href={`/app/online-orders/${o.id}`} className="card hover:border-accent block space-y-1 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">
                    {o.number} · {o.customer_name} <span className="text-muted font-normal">{o.customer_phone}</span>
                  </p>
                  <span className={`rounded px-2 py-0.5 text-xs ${TONE_STYLES[label.tone]}`}>{label.text}</span>
                </div>
                <p className="text-muted text-sm">
                  {o.fulfilment === "delivery" ? "Delivery" : "Collection"} · {o.locations.name} · {items}{" "}
                  {items === 1 ? "item" : "items"} · {formatMoney(o.total_kobo, currency)} ·{" "}
                  {formatDateTime(o.created_at)}
                </p>
                {o.attention && <p className="text-sm text-amber-900">{o.attention}</p>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
