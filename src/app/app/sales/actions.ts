"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { formatMoney } from "@/lib/money";
import { getSiteUrl, whatsappNumber } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/forms";
import { getStaffNames } from "@/lib/staff-names";
import { getReceiptById } from "./receipt-data";

const TILL_ROLES = ["owner", "manager", "cashier"] as const;

export type SaleShare = { number: string; total_kobo: number; change_kobo: number; whatsapp_url: string | null };

/** Sale number, change due, and a WhatsApp link with the online receipt (if the customer gave a phone). */
export async function getSaleShare(saleId: string): Promise<SaleShare | null> {
  await requireStaff(TILL_ROLES);
  const supabase = await createClient();
  const { data: sale } = await supabase
    .from("sales")
    .select(
      "number, total_kobo, receipt_token, customers(name, phone), sale_payments(method, amount_kobo, tendered_kobo)",
    )
    .eq("id", saleId)
    .maybeSingle();
  if (!sale) return null;

  const change = sale.sale_payments.reduce(
    (s, p) => s + (p.method === "cash" && p.tendered_kobo ? p.tendered_kobo - p.amount_kobo : 0),
    0,
  );
  let whatsapp_url: string | null = null;
  if (sale.customers?.phone) {
    const { name, currency } = await getBusinessSettings();
    const link = `${await getSiteUrl()}/r/${sale.receipt_token}`;
    const text = [
      `Hello ${sale.customers.name.split(" ")[0]}, thank you for shopping with ${name}!`,
      `Receipt ${sale.number}: ${formatMoney(sale.total_kobo, currency)}`,
      `View your receipt: ${link}`,
    ].join("\n");
    whatsapp_url = `https://wa.me/${whatsappNumber(sale.customers.phone)}?text=${encodeURIComponent(text)}`;
  }
  return { number: sale.number, total_kobo: sale.total_kobo, change_kobo: change, whatsapp_url };
}

export async function updateFulfilment(
  saleId: string,
  status: "pending" | "out_for_delivery" | "completed",
): Promise<ActionState> {
  await requireStaff(TILL_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_fulfilment", { p_sale_id: saleId, p_status: status });
  if (error) return { error: error.message };
  revalidatePath("/app/sales", "layout");
  return { success: "Updated." };
}

const returnSchema = z.object({
  sale_id: z.uuid(),
  refund_method: z.enum(["cash", "card", "transfer"]),
  reason: z.string().trim().min(1, "Give a reason for the return.").max(300),
  lines: z
    .array(
      z.object({
        sale_line_id: z.uuid(),
        quantity: z.number().min(0),
        condition: z.enum(["restock", "damaged"]),
      }),
    )
    .refine((lines) => lines.some((l) => l.quantity > 0), "Choose at least one item to return."),
});

export async function createReturn(input: z.input<typeof returnSchema>): Promise<ActionState> {
  await requireStaff(TILL_ROLES);
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_return", {
    payload: { ...parsed.data, lines: parsed.data.lines.filter((l) => l.quantity > 0) },
  });
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  redirect(`/app/sales/${parsed.data.sale_id}?returned=1`);
}

/** Everything needed to print a receipt directly on the till's printer (desktop app). */
export async function getReceiptForPrint(saleId: string) {
  await requireStaff(TILL_ROLES);
  const sale = await getReceiptById(saleId);
  if (!sale) return null;
  const [business, names] = await Promise.all([getBusinessSettings(), getStaffNames([sale.cashier_id])]);
  return {
    sale,
    business,
    cashierName: sale.cashier_id ? names.get(sale.cashier_id)?.split(" ")[0] : undefined,
    paidCash: sale.sale_payments.some((p) => p.method === "cash"),
  };
}

/** Records a "no sale" drawer opening; the desktop app then pops the drawer. */
export async function logDrawerOpen(locationId: string, reason: string): Promise<ActionState> {
  await requireStaff(TILL_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_drawer_open", { p_location_id: locationId, p_reason: reason });
  if (error) return { error: error.message };
  return { success: "Logged." };
}
