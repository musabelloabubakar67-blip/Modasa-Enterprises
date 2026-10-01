"use server";

import { redirect } from "next/navigation";
import { confirmPayment, getOrderForPayment } from "@/lib/shop/orders";
import { paymentMode } from "@/lib/shop/paystack";

/** Development only: pretends the payment provider confirmed the payment. */
export async function payTestOrder(reference: string) {
  if (paymentMode() !== "test") throw new Error("Test payments are switched off.");
  const order = await getOrderForPayment(reference);
  if (!order) throw new Error("Order not found.");
  await confirmPayment(reference, order.total_kobo);
  redirect(`/order/${order.token}`);
}
