"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/forms";
import type { SkuOption } from "../stock/actions";

const qty = z
  .string()
  .trim()
  .refine((v) => /^\d+(\.\d{1,3})?$/.test(v), "Quantities must be numbers.");

const createSchema = z.object({
  from_location_id: z.uuid({ error: "Choose where the stock comes from." }),
  to_location_id: z.uuid({ error: "Choose where the stock goes." }),
  note: z.string().max(500).optional(),
  lines: z
    .array(z.object({ sku_id: z.uuid(), quantity: qty }))
    .min(1, "Add at least one item.")
    .refine((lines) => new Set(lines.map((l) => l.sku_id)).size === lines.length, "An item is listed twice."),
});

export type CreateTransferInput = z.input<typeof createSchema>;

export async function createTransfer(input: CreateTransferInput): Promise<ActionState> {
  await requireStaff();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.from_location_id === v.to_location_id) return { error: "Choose two different locations." };
  if (v.lines.some((l) => Number(l.quantity) <= 0)) return { error: "Quantities must be above zero." };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_transfer", {
    payload: { ...v, note: v.note ?? null, lines: v.lines.map((l) => ({ ...l, quantity: Number(l.quantity) })) },
  });
  if (error) return { error: error.message };

  revalidatePath("/app/transfers", "layout");
  redirect(`/app/transfers/${id}?created=1`);
}

const dispatchSchema = z.array(z.object({ sku_id: z.uuid(), batch: z.string().trim().max(40), quantity: qty }));

export async function dispatchTransfer(
  id: string,
  items: z.input<typeof dispatchSchema>,
  note: string,
): Promise<ActionState> {
  await requireStaff();
  const parsed = dispatchSchema.safeParse(items);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Combine duplicate SKU + batch rows before sending.
  const combined = new Map<string, { sku_id: string; batch: string; quantity: number }>();
  for (const item of parsed.data) {
    const n = Number(item.quantity);
    if (n <= 0) continue;
    const key = `${item.sku_id}|${item.batch}`;
    const existing = combined.get(key);
    combined.set(key, { sku_id: item.sku_id, batch: item.batch, quantity: (existing?.quantity ?? 0) + n });
  }
  if (combined.size === 0) return { error: "Enter at least one quantity to send." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("dispatch_transfer", {
    p_transfer_id: id,
    p_items: [...combined.values()],
    p_note: note,
  });
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  redirect(`/app/transfers/${id}?dispatched=1`);
}

const receiveSchema = z.array(
  z.object({ item_id: z.uuid(), received_quantity: qty, reason: z.string().trim().max(200).optional() }),
);

export async function receiveTransfer(id: string, items: z.input<typeof receiveSchema>): Promise<ActionState> {
  await requireStaff();
  const parsed = receiveSchema.safeParse(items);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_transfer", {
    p_transfer_id: id,
    p_items: parsed.data.map((i) => ({ ...i, received_quantity: Number(i.received_quantity) })),
  });
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  redirect(`/app/transfers/${id}?received=1`);
}

export async function cancelTransfer(id: string, reason: string): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_transfer", { p_transfer_id: id, p_reason: reason });
  if (error) return { error: error.message };
  revalidatePath("/app/transfers", "layout");
  return { success: "Request cancelled." };
}

export async function resolveShortage(id: string, resolution: string): Promise<ActionState> {
  await requireStaff(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_transfer_shortage", { p_transfer_id: id, p_resolution: resolution });
  if (error) return { error: error.message };
  revalidatePath("/app/transfers", "layout");
  return { success: "Shortage resolved." };
}

/** Quantity of each SKU available at a location (all batches). */
export async function availableAt(locationId: string, skuIds: string[]): Promise<Record<string, number>> {
  await requireStaff();
  if (skuIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sku_location_stock")
    .select("sku_id, quantity")
    .eq("location_id", locationId)
    .in("sku_id", skuIds);
  if (error) throw error;
  return Object.fromEntries(data.map((d) => [d.sku_id!, Number(d.quantity)]));
}

/**
 * Items at or below their reorder level at a location, with a suggested quantity that brings
 * them up to twice the reorder level, counting anything already on its way or already requested.
 */
export async function lowStockSuggestions(locationId: string): Promise<{ sku: SkuOption; quantity: number }[]> {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: reorders, error }, { data: levels }, { data: transit }, { data: requested }] = await Promise.all([
    supabase
      .from("reorder_levels")
      .select(
        "reorder_level, skus(id, code, barcode, variant_label, price_kobo, promo_price_kobo, is_active, products(name, track_batches, is_active, units(abbreviation, allows_decimal)))",
      )
      .eq("location_id", locationId),
    supabase.from("sku_location_stock").select("sku_id, quantity").eq("location_id", locationId),
    supabase.from("stock_in_transit").select("sku_id, quantity").eq("location_id", locationId),
    supabase
      .from("transfer_lines")
      .select("sku_id, requested_quantity, transfers!inner(to_location_id, status)")
      .eq("transfers.to_location_id", locationId)
      .eq("transfers.status", "requested"),
  ]);
  if (error) throw error;
  const have = new Map(levels?.map((l) => [l.sku_id, Number(l.quantity)]));
  const coming = new Map<string, number>();
  transit?.forEach((t) => coming.set(t.sku_id!, (coming.get(t.sku_id!) ?? 0) + Number(t.quantity)));
  requested?.forEach((r) => coming.set(r.sku_id, (coming.get(r.sku_id) ?? 0) + Number(r.requested_quantity)));

  return reorders
    .filter((r) => r.skus.is_active && r.skus.products.is_active)
    .map((r) => {
      const level = Number(r.reorder_level);
      const current = (have.get(r.skus.id) ?? 0) + (coming.get(r.skus.id) ?? 0);
      const s = r.skus;
      return {
        current,
        level,
        sku: {
          id: s.id,
          code: s.code,
          barcode: s.barcode,
          variant_label: s.variant_label,
          price_kobo: s.price_kobo,
          promo_price_kobo: s.promo_price_kobo,
          product_name: s.products.name,
          unit: s.products.units.abbreviation,
          allows_decimal: s.products.units.allows_decimal,
          track_batches: s.products.track_batches,
        },
      };
    })
    .filter((x) => x.current <= x.level)
    .map((x) => ({ sku: x.sku, quantity: Math.max(1, Math.ceil(x.level * 2 - x.current)) }));
}
