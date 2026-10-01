import { NextResponse, type NextRequest } from "next/server";
import { confirmPayment, getOrderForPayment } from "@/lib/shop/orders";
import { checkPayment, paymentMode } from "@/lib/shop/paystack";

// Where Paystack sends the customer back after paying. The payment is checked with Paystack
// directly; nothing in the address is trusted. (Paystack also notifies /api/paystack/webhook,
// which covers customers who close the window before getting back here.)
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference") ?? request.nextUrl.searchParams.get("trxref");
  const order = reference ? await getOrderForPayment(reference) : null;
  if (!reference || !order) return NextResponse.redirect(new URL("/cart", request.url));

  const orderUrl = new URL(`/order/${order.token}`, request.url);
  if (paymentMode() !== "paystack") return NextResponse.redirect(orderUrl);

  try {
    const payment = await checkPayment(reference);
    if (payment.paid && payment.currency === "NGN") await confirmPayment(reference, payment.amountKobo);
    else orderUrl.searchParams.set("payment", "incomplete");
  } catch (e) {
    // The order page shows the true state; the webhook will still confirm a successful payment.
    console.error("Payment check failed", e);
    orderUrl.searchParams.set("payment", "checking");
  }
  return NextResponse.redirect(orderUrl);
}
