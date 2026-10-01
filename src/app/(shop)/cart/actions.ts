"use server";

import { z } from "zod";
import { planForShops, type ShopPlan } from "@/lib/shop/plan";
import {
  cartLines,
  deliveryAreas,
  getStorefront,
  toLineStock,
  type CartLine,
  type DeliveryArea,
} from "@/lib/shop/data";
import { expireUnpaidOrders, releaseUnpaidOrder } from "@/lib/shop/orders";

const itemsSchema = z.array(z.object({ skuId: z.uuid(), quantity: z.number().positive().max(1000) })).max(60);

/** Current names, prices and availability for the items in the browser's cart. */
export async function loadCart(items: unknown): Promise<CartLine[]> {
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return [];
  return (await cartLines(parsed.data)).lines;
}

export type CheckoutData = { lines: CartLine[]; plans: ShopPlan[]; areas: DeliveryArea[] };

/** As loadCart, plus which shops can hand the order over and how soon. */
export async function loadCheckout(items: unknown): Promise<CheckoutData> {
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return { lines: [], plans: [], areas: [] };
  await expireUnpaidOrders();
  const [{ lines, stock }, shop, areas] = await Promise.all([cartLines(parsed.data), getStorefront(), deliveryAreas()]);
  const plans = planForShops(
    lines.map((l) => toLineStock(l.skuId, l.quantity, stock.get(l.skuId))),
    shop.shops.map((s) => s.id),
  );
  return { lines, plans, areas };
}

/**
 * The customer came back to their cart without paying: release the order they started, so the
 * stock it was holding is available to them again. Needs the order's private token.
 */
export async function releaseOrder(token: unknown): Promise<void> {
  if (typeof token === "string") await releaseUnpaidOrder(token);
}
