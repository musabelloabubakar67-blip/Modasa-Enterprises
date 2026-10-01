"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";
import { cartLines, getStorefront, toLineStock } from "@/lib/shop/data";
import { expireUnpaidOrders } from "@/lib/shop/orders";
import { paymentMode, startPayment } from "@/lib/shop/paystack";
import { bestShopForDelivery, planForShops } from "@/lib/shop/plan";

const orderSchema = z
  .object({
    items: z
      .array(z.object({ skuId: z.uuid(), quantity: z.number().positive().max(1000) }))
      .min(1)
      .max(60),
    fulfilment: z.enum(["collect_later", "delivery"]),
    shopId: z.uuid().optional(),
    name: z.string().trim().min(2, "Enter your name.").max(120),
    phone: z
      .string()
      .transform((s) => s.replace(/\D/g, ""))
      .pipe(z.string().min(10, "Enter a phone number we can reach you on.").max(15, "Check the phone number.")),
    email: z.email("Enter a valid email address.").max(160),
    address: z.string().trim().max(400).optional(),
    areaId: z.uuid().optional(),
    note: z.string().trim().max(500).optional(),
    // Left empty by people; filled in by form-filling robots.
    website: z.string().max(0).optional(),
  })
  .refine((v) => v.fulfilment !== "collect_later" || v.shopId, { path: ["shopId"], message: "Choose a shop." })
  .refine((v) => v.fulfilment !== "delivery" || (v.address && v.address.length >= 8), {
    path: ["address"],
    message: "Enter the full delivery address.",
  })
  .refine((v) => v.fulfilment !== "delivery" || v.areaId, { path: ["areaId"], message: "Choose a delivery area." });

export type OrderInput = z.input<typeof orderSchema>;
export type OrderResult =
  | { ok: true; paymentUrl: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; refresh?: boolean };

/** Creates the order, holds its stock and returns the address of the payment page. */
export async function placeOrder(input: OrderInput): Promise<OrderResult> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Please check the highlighted details.", fieldErrors };
  }
  const v = parsed.data;

  const shop = await getStorefront();
  if (!shop.enabled) return { ok: false, error: "The online shop is closed at the moment." };
  const mode = paymentMode();
  if (mode === "off")
    return { ok: false, error: "Online payment isn't available right now. Please contact us to order." };

  const admin = createAdminClient();
  await expireUnpaidOrders();

  // A new order from the same customer replaces any they started but didn't pay for, so their
  // own earlier attempt doesn't hold the stock they are trying to buy.
  const { data: unpaid, error: unpaidError } = await admin
    .from("online_orders")
    .update({ status: "expired" })
    .eq("customer_phone", v.phone)
    .eq("status", "pending_payment")
    .select("id");
  if (unpaidError) throw unpaidError;
  if (unpaid.length > 0) {
    const { error } = await admin
      .from("stock_holds")
      .delete()
      .in(
        "order_id",
        unpaid.map((o) => o.id),
      );
    if (error) throw error;
  }

  // Decide which shop hands the order over, from what is in stock right now.
  const { lines, stock } = await cartLines(v.items);
  if (lines.length !== v.items.length)
    return {
      ok: false,
      error: "An item in your cart is no longer sold online. Please review your cart.",
      refresh: true,
    };
  const plans = planForShops(
    lines.map((l) => toLineStock(l.skuId, l.quantity, stock.get(l.skuId))),
    shop.shops.map((s) => s.id),
  );
  const plan = v.fulfilment === "delivery" ? bestShopForDelivery(plans) : plans.find((p) => p.shopId === v.shopId);
  if (!plan?.ok) {
    return {
      ok: false,
      refresh: true,
      error:
        v.fulfilment === "delivery"
          ? "Some items have just sold out, or are only at different shops. Please review your cart."
          : "Some items are no longer available at that shop. Please choose another shop or review your cart.",
    };
  }

  const { data, error } = await admin.rpc("create_online_order", {
    payload: {
      location_id: plan.shopId,
      fulfilment: v.fulfilment,
      customer: { name: v.name, phone: v.phone, email: v.email },
      note: v.note ?? null,
      delivery: v.fulfilment === "delivery" ? { address: v.address, area_id: v.areaId } : null,
      lines: lines.map((l) => ({ sku_id: l.skuId, quantity: l.quantity })),
    },
  });
  // 22023 is the database turning the order down for a reason the customer can act on.
  if (error) {
    if (error.code === "22023") return { ok: false, error: error.message, refresh: true };
    throw error;
  }
  const order = data as { id: string; number: string; token: string; reference: string; total_kobo: number };

  let paymentUrl: string;
  if (mode === "paystack") {
    try {
      paymentUrl = await startPayment({
        email: v.email,
        amountKobo: order.total_kobo,
        reference: order.reference,
        callbackUrl: `${await getSiteUrl()}/checkout/callback`,
        orderNumber: order.number,
      });
    } catch (e) {
      console.error("Could not start payment", e);
      await admin.from("stock_holds").delete().eq("order_id", order.id);
      await admin.from("online_orders").update({ status: "expired" }).eq("id", order.id);
      return { ok: false, error: "We couldn't reach the payment service. Please try again in a moment." };
    }
  } else {
    paymentUrl = `/pay/test/${order.reference}`;
  }

  const { error: saveError } = await admin.from("online_orders").update({ payment_url: paymentUrl }).eq("id", order.id);
  if (saveError) throw saveError;
  return { ok: true, paymentUrl };
}
