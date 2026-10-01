"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/forms";

const TILL_ROLES = ["owner", "manager", "cashier"] as const;
const MANAGERS = ["owner", "manager"] as const;

/** Tries again to turn a paid order into a sale, once its stock has reached the shop. */
export async function retryOrder(orderId: string): Promise<ActionState> {
  await requireStaff(TILL_ROLES);
  if (!z.uuid().safeParse(orderId).success) return { error: "Order not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retry_online_order", { p_order_id: orderId });
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  return data === "confirmed"
    ? { success: "Sale created. The order is ready to hand over." }
    : { error: "Some items still aren't at the shop. Receive the transfer first, then try again." };
}

const reasonSchema = z.object({ id: z.uuid(), text: z.string().trim().min(3, "Give a reason.").max(300) });

export async function cancelOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(MANAGERS);
  const parsed = reasonSchema.safeParse({ id: formData.get("id"), text: formData.get("reason") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_online_order", {
    p_order_id: parsed.data.id,
    p_reason: parsed.data.text,
  });
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  return { success: "Order cancelled." };
}

export async function markRefunded(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(MANAGERS);
  const parsed = reasonSchema.safeParse({ id: formData.get("id"), text: formData.get("note") });
  if (!parsed.success) return { error: "Say how the money was returned, e.g. Paystack refund." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_order_refunded", { p_order_id: parsed.data.id, p_note: parsed.data.text });
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  return { success: "Marked as refunded." };
}
