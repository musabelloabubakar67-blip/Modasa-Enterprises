"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseMoney } from "@/lib/money";
import type { ActionState } from "@/lib/forms";

const TILL_ROLES = ["owner", "manager", "cashier"] as const;

export type TillItem = {
  id: string;
  code: string;
  variant_label: string | null;
  product_name: string;
  unit: string;
  allows_decimal: boolean;
  track_batches: boolean;
  price_kobo: number;
  promo_price_kobo: number | null;
  coverage: "none" | "roll" | "area";
  roll_width_cm: number | null;
  roll_length_cm: number | null;
  coverage_m2: number | null;
  /** Stock at this shop per batch ('' = no batch). */
  batches: { batch: string; quantity: number }[];
  elsewhere: { location_id: string; name: string; kind: "shop" | "warehouse"; quantity: number }[];
  inTransitHere: number;
};

/** Everything the till needs to know about an item: price, coverage, and stock here and elsewhere. */
export async function tillItemInfo(skuId: string, shopId: string): Promise<TillItem | null> {
  await requireStaff(TILL_ROLES);
  const supabase = await createClient();
  const [{ data: sku }, { data: levels }, { data: transit }, { data: locations }] = await Promise.all([
    supabase
      .from("skus")
      .select(
        "id, code, variant_label, price_kobo, promo_price_kobo, roll_width_cm, roll_length_cm, coverage_m2, products(name, track_batches, units(abbreviation, allows_decimal, coverage))",
      )
      .eq("id", skuId)
      .maybeSingle(),
    supabase.from("stock_levels").select("location_id, batch, quantity").eq("sku_id", skuId).gt("quantity", 0),
    supabase.from("stock_in_transit").select("quantity").eq("sku_id", skuId).eq("location_id", shopId),
    supabase.from("locations").select("id, name, kind").eq("is_active", true),
  ]);
  if (!sku) return null;

  const byLocation = new Map<string, number>();
  levels?.forEach((l) => byLocation.set(l.location_id, (byLocation.get(l.location_id) ?? 0) + Number(l.quantity)));

  return {
    id: sku.id,
    code: sku.code,
    variant_label: sku.variant_label,
    product_name: sku.products.name,
    unit: sku.products.units.abbreviation,
    allows_decimal: sku.products.units.allows_decimal,
    track_batches: sku.products.track_batches,
    price_kobo: sku.price_kobo,
    promo_price_kobo: sku.promo_price_kobo,
    coverage: sku.products.units.coverage,
    roll_width_cm: sku.roll_width_cm,
    roll_length_cm: sku.roll_length_cm,
    coverage_m2: sku.coverage_m2,
    batches: (levels ?? [])
      .filter((l) => l.location_id === shopId)
      .map((l) => ({ batch: l.batch, quantity: Number(l.quantity) }))
      .sort((a, b) => b.quantity - a.quantity),
    elsewhere: (locations ?? [])
      .filter((l) => l.id !== shopId && (byLocation.get(l.id) ?? 0) > 0)
      .map((l) => ({ location_id: l.id, name: l.name, kind: l.kind, quantity: byLocation.get(l.id)! }))
      .sort((a, b) => (a.kind === b.kind ? b.quantity - a.quantity : a.kind === "warehouse" ? -1 : 1)),
    inTransitHere: (transit ?? []).reduce((s, t) => s + Number(t.quantity), 0),
  };
}

/** Finds a returning customer by phone number, however it was typed. */
export async function lookupCustomer(phone: string) {
  await requireStaff(TILL_ROLES);
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, phone, email, address")
    .eq("phone", digits)
    .maybeSingle();
  return data;
}

export async function openTill(shopId: string, float: string): Promise<ActionState> {
  await requireStaff(TILL_ROLES);
  const kobo = parseMoney(float || "0");
  if (kobo === null || Number.isNaN(kobo)) return { error: "Enter the cash float, e.g. 10000 (or 0)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("open_shift", { p_location_id: shopId, p_float_kobo: kobo });
  if (error) return { error: error.message };
  revalidatePath("/app/pos");
  return { success: "Till opened." };
}

const saleSchema = z.object({
  location_id: z.uuid(),
  note: z.string().max(500).optional(),
  customer: z
    .object({
      name: z.string().trim().max(120),
      phone: z.string().trim().max(30).optional(),
      email: z.string().trim().max(160).optional(),
      address: z.string().trim().max(300).optional(),
    })
    .optional(),
  lines: z
    .array(
      z.object({
        sku_id: z.uuid(),
        batch: z.string().max(40),
        quantity: z.number().positive(),
      }),
    )
    .min(1, "The cart is empty."),
  payments: z
    .array(
      z.object({
        method: z.enum(["cash", "card", "transfer"]),
        amount_kobo: z.number().int().positive(),
        tendered_kobo: z.number().int().positive().optional(),
        reference: z.string().max(120).optional(),
      }),
    )
    .min(1, "Add a payment."),
  fulfilment: z.enum(["taken", "collect_later", "delivery"]),
  delivery: z
    .object({
      address: z.string().trim().max(300),
      area: z.string().trim().max(80).optional(),
      date: z.iso.date().optional(),
      fee_kobo: z.number().int().min(0),
    })
    .optional(),
});

export type SaleInput = z.input<typeof saleSchema>;

export async function completeSale(input: SaleInput): Promise<{ error?: string; saleId?: string }> {
  await requireStaff(TILL_ROLES);
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_sale", { payload: parsed.data });
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  return { saleId: data };
}

export async function closeTill(
  shiftId: string,
  counted: { cash: string; card: string; transfer: string },
  note: string,
): Promise<ActionState> {
  await requireStaff(TILL_ROLES);
  const cash = parseMoney(counted.cash);
  const card = parseMoney(counted.card);
  const transfer = parseMoney(counted.transfer);
  if (cash === null || Number.isNaN(cash)) return { error: "Count the cash in the drawer and enter the total." };
  if (Number.isNaN(card) || Number.isNaN(transfer)) return { error: "Check the card and transfer amounts." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_shift", {
    p_shift_id: shiftId,
    p_counted_cash: cash,
    p_counted_card: card as number,
    p_counted_transfer: transfer as number,
    p_note: note,
  });
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  return { success: "Till closed." };
}
