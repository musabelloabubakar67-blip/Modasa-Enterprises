import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Online card and bank payments through Paystack. The secret key lives in PAYSTACK_SECRET_KEY
// (test key while building, live key once the shop is public). Without a key, development
// machines get a stand-in payment page so the rest of the shop can be tried out.

const API = "https://api.paystack.co";

export type PaymentMode = "paystack" | "test" | "off";

export function paymentMode(): PaymentMode {
  if (process.env.PAYSTACK_SECRET_KEY) return "paystack";
  return process.env.NODE_ENV === "production" ? "off" : "test";
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as { status: boolean; message: string; data: T } | null;
  if (!response.ok || !body?.status) throw new Error(body?.message ?? `Payment provider error (${response.status})`);
  return body.data;
}

/** Starts a payment and returns the address of Paystack's payment page for it. */
export async function startPayment(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  orderNumber: string;
}) {
  const data = await call<{ authorization_url: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: {
        custom_fields: [{ display_name: "Order", variable_name: "order", value: input.orderNumber }],
      },
    }),
  });
  return data.authorization_url;
}

export type PaymentResult = { paid: boolean; amountKobo: number; currency: string; status: string };

/** Asks Paystack what happened to a payment. Never trust the browser's word for it. */
export async function checkPayment(reference: string): Promise<PaymentResult> {
  const data = await call<{ status: string; amount: number; currency: string }>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  return { paid: data.status === "success", amountKobo: data.amount, currency: data.currency, status: data.status };
}

/** Paystack signs each notification with the secret key; anything unsigned is ignored. */
export function isFromPaystack(rawBody: string, signature: string | null) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !signature) return false;
  const expected = Buffer.from(createHmac("sha512", key).update(rawBody).digest("hex"));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
