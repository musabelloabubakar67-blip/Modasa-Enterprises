import { confirmPayment } from "@/lib/shop/orders";
import { isFromPaystack } from "@/lib/shop/paystack";

// Paystack calls this address when a payment succeeds, whether or not the customer comes back to
// the site. Set it as the Webhook URL in the Paystack dashboard: https://<your site>/api/paystack/webhook
export async function POST(request: Request) {
  const body = await request.text();
  if (!isFromPaystack(body, request.headers.get("x-paystack-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string; amount?: number; currency?: string } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { reference, amount, currency } = event.data ?? {};
  if (event.event === "charge.success" && reference && typeof amount === "number" && currency === "NGN") {
    try {
      await confirmPayment(reference, amount);
    } catch (e) {
      const code = (e as { code?: string }).code;
      // Not one of our orders, or underpaid (already flagged for staff): nothing to retry.
      if (code !== "P0002" && code !== "22023") {
        console.error("Could not record payment", reference, e);
        return new Response("Try again later", { status: 500 });
      }
    }
  }
  return new Response("ok");
}
