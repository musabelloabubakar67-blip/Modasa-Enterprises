import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getSiteUrl, whatsappNumber } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { isManager } from "../../stock/data";
import { TONE_STYLES, orderLabel } from "../status";
import { CancelForm, RefundForm, RetryButton } from "./order-actions";

export default async function OnlineOrderPage({ params }: PageProps<"/app/online-orders/[id]">) {
  const staff = await requireStaff(["owner", "manager", "cashier"]);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("online_orders")
    .select(
      `id, number, token, status, fulfilment, customer_name, customer_phone, customer_email, delivery_address,
       delivery_area, delivery_fee_kobo, subtotal_kobo, total_kobo, note, payment_reference, paid_at, paid_amount_kobo,
       attention, expires_at, cancelled_reason, refunded_at, refund_note, created_at,
       locations(name), sales(id, number, fulfilment_status),
       online_order_lines(quantity, unit_price_kobo, line_total_kobo, sort_order, skus(code, variant_label, products(name)))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!order) notFound();

  const [{ data: holds }, business, siteUrl] = await Promise.all([
    supabase.from("stock_holds").select("quantity, skus(code), locations(name)").eq("order_id", id),
    getBusinessSettings(),
    getSiteUrl(),
  ]);
  const { currency } = business;
  const label = orderLabel({ ...order, handover: order.sales?.fulfilment_status });
  const manager = isManager(staff.role);
  const waiting = order.status === "paid" || order.status === "awaiting_stock";
  const cancellable = waiting || order.status === "pending_payment";
  const refundDue = order.status === "cancelled" && order.paid_at !== null;
  const customerLink = `${siteUrl}/order/${order.token}`;
  const firstName = order.customer_name.split(" ")[0];
  const message =
    order.status === "confirmed"
      ? order.fulfilment === "delivery"
        ? `Hello ${firstName}, your ${business.name} order ${order.number} is ready. When would you like it delivered?`
        : `Hello ${firstName}, your ${business.name} order ${order.number} is ready to collect at ${order.locations.name}.`
      : `Hello ${firstName}, this is ${business.name} about your order ${order.number}.`;
  const whatsapp = `https://wa.me/${whatsappNumber(order.customer_phone)}?text=${encodeURIComponent(`${message}\n${customerLink}`)}`;
  const lines = [...order.online_order_lines].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="max-w-3xl">
      <Link href="/app/online-orders" className="text-muted text-sm hover:underline">
        ← Online orders
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{order.number}</h1>
        <span className={`rounded px-2 py-0.5 text-xs ${TONE_STYLES[label.tone]}`}>{label.text}</span>
      </div>
      <p className="text-muted mt-1 text-sm">
        Placed {formatDateTime(order.created_at)} ·{" "}
        {order.fulfilment === "delivery" ? "Delivery from" : "Collection at"} {order.locations.name}
      </p>

      {order.attention && (
        <p role="status" className="mt-4 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
          {order.attention}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="card space-y-1 p-4 text-sm">
          <h2 className="font-semibold">Customer</h2>
          <p>{order.customer_name}</p>
          <p className="text-muted">
            {order.customer_phone}
            {order.customer_email && ` · ${order.customer_email}`}
          </p>
          {order.fulfilment === "delivery" && (
            <p>
              {order.delivery_address}
              {order.delivery_area && <span className="text-muted"> ({order.delivery_area})</span>}
            </p>
          )}
          {order.note && <p className="text-muted">Note: {order.note}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            <a href={whatsapp} target="_blank" rel="noreferrer" className="btn btn-secondary">
              WhatsApp customer
            </a>
            <Link href={`/order/${order.token}`} target="_blank" className="btn btn-secondary">
              Customer&apos;s view
            </Link>
          </div>
        </section>

        <section className="card space-y-1 p-4 text-sm">
          <h2 className="font-semibold">Payment</h2>
          {order.paid_at ? (
            <p>
              Paid {formatMoney(order.paid_amount_kobo ?? order.total_kobo, currency)} online ·{" "}
              {formatDateTime(order.paid_at)}
            </p>
          ) : order.status === "pending_payment" ? (
            <p>Not paid yet. Stock is held until {formatDateTime(order.expires_at)}.</p>
          ) : (
            <p>No payment was received.</p>
          )}
          <p className="text-muted break-all">Reference {order.payment_reference}</p>
          {order.cancelled_reason && <p>Cancelled: {order.cancelled_reason}</p>}
          {order.refunded_at && (
            <p>
              Refunded {formatDateTime(order.refunded_at)}
              {order.refund_note && ` · ${order.refund_note}`}
            </p>
          )}
          {order.sales && (
            <p className="pt-2">
              <Link href={`/app/sales/${order.sales.id}`} className="text-accent hover:underline">
                Sale {order.sales.number}
              </Link>
              {order.sales.fulfilment_status !== "completed" && (
                <>
                  {" "}
                  ·{" "}
                  <Link href="/app/sales/pending" className="text-accent hover:underline">
                    hand over
                  </Link>
                </>
              )}
            </p>
          )}
        </section>
      </div>

      <table className="card mt-4 w-full text-sm">
        <thead className="text-muted text-left">
          <tr>
            <th className="p-3 font-medium">Item</th>
            <th className="p-3 text-right font-medium">Qty</th>
            <th className="p-3 text-right font-medium">Price</th>
            <th className="p-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="p-3">
                {l.skus.products.name}
                {l.skus.variant_label && ` (${l.skus.variant_label})`}{" "}
                <span className="text-muted font-mono text-xs">{l.skus.code}</span>
              </td>
              <td className="p-3 text-right tabular-nums">{Number(l.quantity)}</td>
              <td className="p-3 text-right tabular-nums">{formatMoney(l.unit_price_kobo, currency)}</td>
              <td className="p-3 text-right tabular-nums">{formatMoney(l.line_total_kobo, currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-border border-t">
          {order.delivery_fee_kobo > 0 && (
            <tr>
              <td colSpan={3} className="px-3 pt-3 text-right">
                Delivery
              </td>
              <td className="px-3 pt-3 text-right tabular-nums">{formatMoney(order.delivery_fee_kobo, currency)}</td>
            </tr>
          )}
          <tr className="font-medium">
            <td colSpan={3} className="p-3 text-right">
              Total
            </td>
            <td className="p-3 text-right tabular-nums">{formatMoney(order.total_kobo, currency)}</td>
          </tr>
        </tfoot>
      </table>

      {holds && holds.length > 0 && (
        <p className="text-muted mt-3 text-sm">
          Held for this order:{" "}
          {holds.map((h) => `${Number(h.quantity)} × ${h.skus.code} at ${h.locations.name}`).join(", ")}.
        </p>
      )}

      {(waiting || (manager && (cancellable || refundDue))) && (
        <section className="card mt-6 space-y-5 p-4">
          <h2 className="font-semibold">What next</h2>
          {waiting && (
            <div className="space-y-2">
              <p className="text-sm">
                A transfer has been requested from the warehouse (see{" "}
                <Link href="/app/transfers" className="text-accent hover:underline">
                  Transfers
                </Link>
                ). When it has been received at {order.locations.name}, create the sale so the order can be handed over.
              </p>
              <RetryButton orderId={order.id} />
            </div>
          )}
          {manager && refundDue && <RefundForm orderId={order.id} />}
          {manager && cancellable && <CancelForm orderId={order.id} paid={order.paid_at !== null} />}
        </section>
      )}
    </div>
  );
}
