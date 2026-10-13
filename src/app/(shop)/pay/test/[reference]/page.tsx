import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { getStorefront } from "@/lib/shop/data";
import { getOrderForPayment } from "@/lib/shop/orders";
import { paymentMode } from "@/lib/shop/paystack";
import { payTestOrder } from "./actions";

export const metadata: Metadata = { title: "Test payment", robots: { index: false } };

// Stands in for Paystack's payment page on a development machine with no Paystack key.
// It does not exist once a key is set or the site is running in production.
export default async function TestPaymentPage({ params }: PageProps<"/pay/test/[reference]">) {
  if (paymentMode() !== "test") notFound();
  const { reference } = await params;
  const [order, shop] = await Promise.all([getOrderForPayment(reference), getStorefront()]);
  if (!order) notFound();

  return (
    <div className="shop-wrap max-w-lg py-16">
      <p className="caps text-accent">Test mode · no real money</p>
      <h1 className="mt-3 font-serif text-4xl">Pay {formatMoney(order.total_kobo, shop.currency)}</h1>
      <p className="text-muted mt-3">
        Order {order.number} for {order.customer_name}. This page stands in for Paystack until the payment keys are
        added.
      </p>
      {order.status === "pending_payment" || order.status === "expired" ? (
        <form action={payTestOrder.bind(null, reference)} className="mt-8 flex flex-wrap gap-3">
          <button type="submit" className="shop-btn">
            Pay now (test)
          </button>
          <Link href={`/order/${order.token}`} className="shop-btn shop-btn-outline">
            Leave without paying
          </Link>
        </form>
      ) : (
        <Link href={`/order/${order.token}`} className="shop-btn mt-8">
          View your order
        </Link>
      )}
    </div>
  );
}
