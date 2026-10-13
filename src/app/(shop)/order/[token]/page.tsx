import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearCart } from "@/components/shop/clear-cart";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { whatsappNumber } from "@/lib/phone";
import { getStorefront } from "@/lib/shop/data";
import { expireUnpaidOrders, getOrderByToken, type CustomerOrder } from "@/lib/shop/orders";

// Private to whoever has the link, and never indexed by search engines.
export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

type Tone = "good" | "wait" | "bad";

function describe(
  order: CustomerOrder,
  shopName: string,
  leadTime: string,
): { tone: Tone; title: string; text: string; step: number } {
  const delivery = order.fulfilment === "delivery";
  switch (order.status) {
    case "pending_payment":
      return {
        tone: "wait",
        step: 0,
        title: "Waiting for your payment",
        text: `We are holding your items until ${formatDateTime(order.expires_at)}. Complete the payment to confirm your order.`,
      };
    case "expired":
      return {
        tone: "bad",
        step: 0,
        title: "This order was not paid for",
        text: "The items have been released. You are welcome to order again.",
      };
    case "cancelled":
      return {
        tone: "bad",
        step: 0,
        title: "This order was cancelled",
        text: order.paid_at ? "Your payment is being refunded. We will be in touch." : "No payment was taken.",
      };
    case "refunded":
      return { tone: "bad", step: 0, title: "This order was refunded", text: "Your payment has been returned to you." };
    case "paid":
    case "awaiting_stock":
      return {
        tone: "good",
        step: 1,
        title: "Thank you. Your order is confirmed",
        text: delivery
          ? `We are getting your items ready, usually within ${leadTime}, and will call you to agree a delivery time.`
          : `We are bringing your items to ${shopName}, usually within ${leadTime}. We will let you know when they are ready to collect.`,
      };
    case "confirmed": {
      const stage = order.sales?.fulfilment_status ?? "pending";
      if (stage === "completed")
        return {
          tone: "good",
          step: 3,
          title: delivery ? "Delivered" : "Collected",
          text: "Thank you for shopping with us. We hope you love it.",
        };
      if (stage === "out_for_delivery")
        return { tone: "good", step: 2, title: "Out for delivery", text: "Your order is on its way to you." };
      return {
        tone: "good",
        step: 2,
        title: delivery ? "Thank you. Your order is being prepared" : `Ready to collect at ${shopName}`,
        text: delivery
          ? "We will call you to agree a delivery time."
          : "Bring your order number when you come. Someone else can collect for you if they have it.",
      };
    }
  }
}

export default async function OrderPage({ params, searchParams }: PageProps<"/order/[token]">) {
  const { token } = await params;
  const { payment } = await searchParams;
  await expireUnpaidOrders();
  const [order, shop] = await Promise.all([getOrderByToken(token), getStorefront()]);
  if (!order) notFound();

  const shopName = order.locations.public_name || order.locations.name;
  const delivery = order.fulfilment === "delivery";
  const state = describe(order, shopName, shop.leadTime);
  const paid = order.paid_at !== null;
  const steps = [
    "Order placed",
    "Paid",
    delivery ? "On its way" : "Ready to collect",
    delivery ? "Delivered" : "Collected",
  ];
  const border = { good: "border-success", wait: "border-accent", bad: "border-sale" }[state.tone];
  const whatsapp = shop.whatsapp
    ? `https://wa.me/${whatsappNumber(shop.whatsapp)}?text=${encodeURIComponent(`Hello, I am asking about my order ${order.number}.`)}`
    : null;
  const lines = [...order.online_order_lines].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="shop-wrap max-w-[860px] py-10 md:py-14">
      {paid && <ClearCart orderNumber={order.number} />}
      <p className="caps text-muted">Order {order.number}</p>
      <h1 className="mt-2 font-serif text-[clamp(30px,4vw,44px)] leading-[1.1] text-balance">{state.title}</h1>
      <p className={`bg-tint mt-6 border-l-2 px-4 py-3 ${border}`}>{state.text}</p>

      {order.status === "pending_payment" && (
        <div className="mt-6">
          {payment === "incomplete" && (
            <p role="alert" className="text-sale mb-3 text-sm">
              The payment didn&apos;t go through. You can try again below.
            </p>
          )}
          {order.payment_url && (
            <a href={order.payment_url} className="shop-btn">
              Continue to payment
            </a>
          )}
        </div>
      )}
      {payment === "checking" && !paid && (
        <p role="status" className="text-muted mt-4 text-sm">
          We are still confirming your payment with the bank. Refresh this page in a minute.
        </p>
      )}
      {order.status === "expired" && (
        <Link href="/shop" className="shop-btn mt-6">
          Back to the shop
        </Link>
      )}

      {state.tone === "good" && (
        <ol className="mt-10 grid grid-cols-4 gap-2 text-xs sm:text-sm">
          {steps.map((label, i) => (
            <li
              key={label}
              aria-current={i === state.step ? "step" : undefined}
              className={`border-t-2 pt-2 ${i <= state.step ? "border-success" : "border-border text-muted"}`}
            >
              {label}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-12 grid gap-10 md:grid-cols-[1fr_280px]">
        <section>
          <h2 className="caps text-muted mb-1">Items</h2>
          <ul className="divide-border border-border divide-y border-y">
            {lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-4 py-3">
                <span>
                  {Number(l.quantity)} ×{" "}
                  <Link href={`/p/${l.skus.products.slug}`} className="underline-offset-4 hover:underline">
                    {l.skus.products.name}
                  </Link>
                  {l.skus.variant_label && <span className="text-muted"> · {l.skus.variant_label}</span>}
                </span>
                <span className="shrink-0 tabular-nums">{formatMoney(l.line_total_kobo, shop.currency)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatMoney(order.subtotal_kobo, shop.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{delivery ? `Delivery${order.delivery_area ? ` · ${order.delivery_area}` : ""}` : "Collection"}</dt>
              <dd className="tabular-nums">
                {order.delivery_fee_kobo === 0 ? "Free" : formatMoney(order.delivery_fee_kobo, shop.currency)}
              </dd>
            </div>
            <div className="flex justify-between pt-2 text-base font-medium">
              <dt>{paid ? "Total paid" : "Total"}</dt>
              <dd className="tabular-nums">{formatMoney(order.total_kobo, shop.currency)}</dd>
            </div>
          </dl>
          {order.sales && (
            <Link href={`/r/${order.sales.receipt_token}`} className="shop-link mt-5 inline-block text-sm">
              View your receipt
            </Link>
          )}
        </section>

        <aside className="space-y-6 text-sm">
          <div>
            <h2 className="caps text-muted mb-1.5">{delivery ? "Delivering to" : "Collect from"}</h2>
            {delivery ? (
              <p>
                {order.customer_name}
                <br />
                {order.delivery_address}
              </p>
            ) : (
              <p>
                <span className="font-medium">{shopName}</span>
                {order.locations.address && (
                  <>
                    <br />
                    {order.locations.address}
                  </>
                )}
                {shop.openingHours && (
                  <>
                    <br />
                    <span className="text-muted">{shop.openingHours}</span>
                  </>
                )}
              </p>
            )}
          </div>
          <div>
            <h2 className="caps text-muted mb-1.5">Questions?</h2>
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noreferrer" className="shop-link">
                Message us on WhatsApp
              </a>
            ) : (
              <p>{order.locations.phone ?? shop.phone ?? "Contact the shop."}</p>
            )}
            <p className="text-muted mt-2">Keep this page&apos;s link to check on your order.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
