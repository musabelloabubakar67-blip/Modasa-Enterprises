import type { Database } from "@/lib/supabase/database.types";

export type OrderStatus = Database["public"]["Enums"]["online_order_status"];

type OrderState = { status: OrderStatus; paid_at: string | null; handover?: string | null };

/** What staff should understand about an order at a glance. */
export function orderLabel(order: OrderState): { text: string; tone: "action" | "good" | "wait" | "muted" } {
  switch (order.status) {
    case "pending_payment":
      return { text: "Waiting for payment", tone: "wait" };
    case "paid":
    case "awaiting_stock":
      return { text: "Paid · waiting for stock", tone: "action" };
    case "confirmed":
      return order.handover === "completed"
        ? { text: "Handed over", tone: "muted" }
        : order.handover === "out_for_delivery"
          ? { text: "Out for delivery", tone: "good" }
          : { text: "Ready to hand over", tone: "good" };
    case "cancelled":
      return order.paid_at ? { text: "Cancelled · refund due", tone: "action" } : { text: "Cancelled", tone: "muted" };
    case "refunded":
      return { text: "Refunded", tone: "muted" };
    case "expired":
      return { text: "Not paid", tone: "muted" };
  }
}

export const TONE_STYLES = {
  action: "bg-amber-100 text-amber-900",
  good: "bg-success/10 text-success",
  wait: "bg-background text-muted",
  muted: "bg-background text-muted",
} as const;

/** Paid orders that someone has to do something about. */
export function needsAttention(order: OrderState) {
  return orderLabel(order).tone === "action";
}
