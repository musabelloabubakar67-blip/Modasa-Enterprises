"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseMoney } from "@/lib/money";
import type { ActionState } from "@/lib/forms";

export type SkuOption = {
  id: string;
  code: string;
  barcode: string | null;
  variant_label: string | null;
  price_kobo: number;
  promo_price_kobo: number | null;
  product_name: string;
  unit: string;
  allows_decimal: boolean;
  track_batches: boolean;
};

/** Search active SKUs by name, code, variant or barcode. An exact code/barcode match comes first. */
export async function searchSkus(query: string): Promise<SkuOption[]> {
  await requireStaff();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const supabase = await createClient();
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data, error } = await supabase
    .from("skus")
    .select(
      "id, code, variant_label, barcode, price_kobo, promo_price_kobo, products!inner(name, track_batches, is_active, search_text, units(abbreviation, allows_decimal))",
    )
    .eq("is_active", true)
    .eq("products.is_active", true)
    .ilike("products.search_text", `%${escaped}%`)
    .order("code")
    .limit(40);
  if (error) throw error;

  // The search matched the product; rank exact code/barcode hits first, then SKUs whose own
  // code, variant or barcode contains the text (e.g. "4 × 6" among a rug's sizes).
  const rank = (s: (typeof data)[number]) => {
    if (s.code.toLowerCase() === q || s.barcode?.toLowerCase() === q) return 0;
    return `${s.code} ${s.variant_label ?? ""} ${s.barcode ?? ""}`.toLowerCase().includes(q) ? 1 : 2;
  };
  return data
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 15)
    .map((s) => ({
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
    }));
}

/** Batches that currently have stock for a SKU at a location (for counts and write-offs). */
export async function batchesAt(skuId: string, locationId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_levels")
    .select("batch, quantity")
    .eq("sku_id", skuId)
    .eq("location_id", locationId)
    .order("batch");
  if (error) throw error;
  return data;
}

function dbError(error: { code?: string; message: string }) {
  if (error.code === "42501") return error.message || "You don't have permission to do that.";
  return error.message;
}

// ---------- Deliveries ----------

export type ReceiptLineInput = { sku_id: string; batch: string; quantity: string; unit_cost: string };

const quantity = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d{1,3})?$/.test(v) && Number(v) > 0, `${label} must be a number above zero.`);

const receiptSchema = z.object({
  id: z.uuid().optional(),
  location_id: z.uuid({ error: "Choose a warehouse." }),
  supplier_name: z.string().max(160).optional(),
  supplier_reference: z.string().max(80).optional(),
  received_on: z.iso.date({ error: "Choose a date." }),
  note: z.string().max(1000).optional(),
  lines: z
    .array(
      z.object({
        sku_id: z.uuid(),
        batch: z.string().trim().max(40),
        quantity: quantity("Quantity"),
        unit_cost: z.string(),
      }),
    )
    .min(1, "Add at least one item."),
});

export type ReceiptInput = z.input<typeof receiptSchema>;

export async function saveReceipt(input: ReceiptInput, post: boolean): Promise<ActionState & { id?: string }> {
  const staff = await requireStaff(["owner", "manager", "warehouse"]);
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const canCost = staff.role === "owner" || staff.role === "manager";

  const lines = [];
  for (const line of v.lines) {
    const cost = parseMoney(line.unit_cost);
    if (Number.isNaN(cost)) return { error: `Invalid unit cost “${line.unit_cost}”.` };
    lines.push({
      sku_id: line.sku_id,
      batch: line.batch,
      quantity: Number(line.quantity),
      ...(canCost ? { unit_cost_kobo: cost } : {}),
    });
  }

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("save_receipt", {
    payload: {
      ...(v.id ? { id: v.id } : {}),
      location_id: v.location_id,
      supplier_name: v.supplier_name ?? null,
      supplier_reference: v.supplier_reference ?? null,
      received_on: v.received_on,
      note: v.note ?? null,
      lines,
    },
  });
  if (error) return { error: dbError(error), id: v.id };

  if (post) {
    const { error: postError } = await supabase.rpc("post_receipt", { p_receipt_id: id });
    if (postError) {
      revalidatePath(`/app/stock/deliveries/${id}`);
      return { error: `Saved as draft, but not posted: ${dbError(postError)}`, id };
    }
  }

  revalidatePath("/app/stock", "layout");
  redirect(`/app/stock/deliveries/${id}?${post ? "posted" : "saved"}=1`);
}

export async function cancelReceipt(id: string): Promise<ActionState> {
  await requireStaff(["owner", "manager", "warehouse"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_receipt", { p_receipt_id: id });
  if (error) return { error: dbError(error) };
  revalidatePath("/app/stock", "layout");
  return { success: "Delivery cancelled." };
}

// ---------- Adjustments ----------

const adjustmentSchema = z.object({
  location_id: z.uuid({ error: "Choose a location." }),
  kind: z.enum(["opening", "count", "damage"]),
  note: z.string().max(1000).optional(),
  lines: z
    .array(
      z.object({
        sku_id: z.uuid(),
        batch: z.string().trim().max(40),
        quantity: z
          .string()
          .trim()
          .refine((v) => /^\d+(\.\d{1,3})?$/.test(v), "Quantities must be numbers of zero or more."),
        reason: z.string().trim().max(200).optional(),
      }),
    )
    .min(1, "Add at least one item."),
});

export type AdjustmentInput = z.input<typeof adjustmentSchema>;

export async function submitAdjustment(input: AdjustmentInput): Promise<ActionState> {
  await requireStaff();
  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const seen = new Set<string>();
  for (const line of v.lines) {
    const key = `${line.sku_id}|${line.batch.toLowerCase()}`;
    if (seen.has(key)) return { error: "The same item and batch is listed twice. Combine them into one line." };
    seen.add(key);
    if (v.kind === "damage" && Number(line.quantity) <= 0) return { error: "Write-off quantities must be above zero." };
    if (v.kind === "damage" && !line.reason) return { error: "Give a reason for each write-off." };
  }

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("submit_adjustment", {
    payload: {
      location_id: v.location_id,
      kind: v.kind,
      note: v.note ?? null,
      lines: v.lines.map((l) => ({ ...l, quantity: Number(l.quantity) })),
    },
  });
  if (error) return { error: dbError(error) };

  revalidatePath("/app/stock", "layout");
  redirect(`/app/stock/adjustments/${id}?submitted=1`);
}

export async function reviewAdjustment(id: string, approve: boolean, note: string): Promise<ActionState> {
  await requireStaff(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = approve
    ? await supabase.rpc("approve_adjustment", { p_adjustment_id: id, p_review_note: note })
    : await supabase.rpc("reject_adjustment", { p_adjustment_id: id, p_review_note: note });
  if (error) return { error: dbError(error) };
  revalidatePath("/app/stock", "layout");
  return { success: approve ? "Approved — stock updated." : "Rejected." };
}

// ---------- Reorder levels ----------

export async function setReorderLevel(skuId: string, locationId: string, value: string): Promise<ActionState> {
  await requireStaff(["owner", "manager"]);
  const trimmed = value.trim();
  if (trimmed && !/^\d+(\.\d{1,3})?$/.test(trimmed)) return { error: "Enter a number, or leave blank for none." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_reorder_level", {
    p_sku_id: skuId,
    p_location_id: locationId,
    p_level: trimmed ? Number(trimmed) : (null as unknown as number),
  });
  if (error) return { error: dbError(error) };
  revalidatePath(`/app/stock/${skuId}`);
  return { success: "Saved." };
}
