"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseMoney } from "@/lib/money";
import type { ActionState } from "@/lib/forms";

const EDITORS = ["owner", "manager"] as const;

/** One SKU row as typed in the product form. Money arrives as text, e.g. "18,500". */
export type SkuFormRow = {
  id?: string;
  code: string;
  variant_label: string;
  price: string;
  promo_price: string;
  cost: string;
  barcode: string;
  roll_width_cm: string;
  roll_length_cm: string;
  coverage_m2: string;
  is_active: boolean;
};

function positiveOrNull(value: string, label: string, ctx: z.RefinementCtx, path: (string | number)[]) {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    ctx.addIssue({ code: "custom", path, message: `${label} must be a positive number.` });
    return null;
  }
  return n;
}

function skuRowsToPayload(rows: SkuFormRow[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  return rows.map((row, i) => {
    const code = row.code.trim();
    if (!code) ctx.addIssue({ code: "custom", path: [i, "code"], message: "Enter a SKU code." });
    else if (/\s/.test(code)) ctx.addIssue({ code: "custom", path: [i, "code"], message: "No spaces in codes." });
    else if (seen.has(code.toLowerCase()))
      ctx.addIssue({ code: "custom", path: [i, "code"], message: "Code used twice." });
    seen.add(code.toLowerCase());

    const price = parseMoney(row.price);
    const promo = parseMoney(row.promo_price);
    const cost = parseMoney(row.cost);
    if (price === null || Number.isNaN(price))
      ctx.addIssue({ code: "custom", path: [i, "price"], message: "Enter a valid price." });
    if (Number.isNaN(promo)) ctx.addIssue({ code: "custom", path: [i, "promo_price"], message: "Invalid amount." });
    else if (promo !== null && price !== null && promo >= price)
      ctx.addIssue({ code: "custom", path: [i, "promo_price"], message: "Must be below the price." });
    if (Number.isNaN(cost)) ctx.addIssue({ code: "custom", path: [i, "cost"], message: "Invalid amount." });

    const barcode = row.barcode.trim();
    if (/\s/.test(barcode)) ctx.addIssue({ code: "custom", path: [i, "barcode"], message: "No spaces in barcodes." });

    return {
      ...(row.id ? { id: row.id } : {}),
      code,
      variant_label: row.variant_label.trim() || null,
      price_kobo: price,
      promo_price_kobo: promo,
      cost_kobo: cost,
      barcode: barcode || null,
      roll_width_cm: positiveOrNull(row.roll_width_cm, "Width", ctx, [i, "roll_width_cm"]),
      roll_length_cm: positiveOrNull(row.roll_length_cm, "Length", ctx, [i, "roll_length_cm"]),
      coverage_m2: positiveOrNull(row.coverage_m2, "Coverage", ctx, [i, "coverage_m2"]),
      is_active: row.is_active,
      sort_order: i + 1,
    };
  });
}

const productSchema = z.object({
  id: z.uuid().optional(),
  name: z.string({ error: "Enter a product name." }).trim().min(1, "Enter a product name.").max(160),
  category_id: z.uuid({ error: "Choose a category." }),
  unit_id: z.uuid({ error: "Choose a unit." }),
  description: z.string().max(2000).optional(),
  is_active: z.enum(["on"]).optional(),
  skus: z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as SkuFormRow[];
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid SKU data." });
        return z.NEVER;
      }
    })
    .pipe(z.array(z.any()).min(1, "Add at least one SKU.")),
});

export type ProductActionState = ActionState & { skuErrors?: Record<number, Record<string, string>> };

export async function saveProduct(_prev: ProductActionState, formData: FormData): Promise<ProductActionState> {
  await requireStaff(EDITORS);

  const raw = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === "string" && v.trim() !== ""),
  ) as Record<string, string>;
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const skuErrors: Record<number, Record<string, string>> = {};
  const skus = z
    .array(z.any())
    .transform((rows, ctx) => skuRowsToPayload(rows as SkuFormRow[], ctx))
    .safeParse(parsed.data.skus);
  if (!skus.success) {
    for (const issue of skus.error.issues) {
      const [index, field] = issue.path as [number, string];
      (skuErrors[index] ??= {})[field] ??= issue.message;
    }
    return { error: "Please fix the highlighted SKU fields.", skuErrors };
  }

  const { id, name, category_id, unit_id, description, is_active } = parsed.data;
  const supabase = await createClient();
  const { data: productId, error } = await supabase.rpc("save_product", {
    payload: {
      ...(id ? { id } : {}),
      name,
      category_id,
      unit_id,
      description: description ?? null,
      is_active: is_active === "on",
      skus: skus.data,
    },
  });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath("/app/products", "layout");
  // Reload the page so the form shows exactly what was stored (including ids of new SKUs).
  redirect(`/app/products/${productId}?${id ? "saved" : "created"}=1`);
}

function friendlyDbError(error: { code?: string; message: string; details?: string }) {
  if (error.code === "23505") {
    if (error.message.includes("skus_scan_code_key"))
      return "A barcode or SKU code is already used by another item. Each code must scan to exactly one item.";
    if (error.message.includes("skus_code_key")) return "One of these SKU codes is already used by another item.";
    return error.message;
  }
  if (error.code === "42501") return "You don't have permission to edit products.";
  return error.message;
}

// ---------- Categories & units ----------

const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string({ error: "Enter a name." }).trim().min(1, "Enter a name.").max(80),
  sort_order: z.coerce.number().int().min(0).max(9999).optional(),
  is_active: z.enum(["on"]).optional(),
});

export async function saveCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(EDITORS);
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, name, sort_order, is_active } = parsed.data;

  const supabase = await createClient();
  const { error } = id
    ? await supabase
        .from("categories")
        .update({ name, sort_order: sort_order ?? 0, is_active: is_active === "on" })
        .eq("id", id)
    : await supabase.from("categories").insert({ name, sort_order: sort_order ?? 0 });
  if (error) return { error: error.code === "23505" ? "A category with that name already exists." : error.message };

  revalidatePath("/app/products", "layout");
  return { success: id ? "Category saved." : `Added “${name}”.` };
}

const unitSchema = z.object({
  id: z.uuid().optional(),
  name: z.string({ error: "Enter a name." }).trim().min(1, "Enter a name.").max(40),
  abbreviation: z.string({ error: "Enter a short form." }).trim().min(1, "Enter a short form.").max(10),
  allows_decimal: z.enum(["on"]).optional(),
  coverage: z.enum(["none", "roll", "area"]),
});

export async function saveUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(EDITORS);
  const parsed = unitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, allows_decimal, ...rest } = parsed.data;
  const row = { ...rest, allows_decimal: allows_decimal === "on" };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("units").update(row).eq("id", id)
    : await supabase.from("units").insert(row);
  if (error) return { error: error.code === "23505" ? "A unit with that name already exists." : error.message };

  revalidatePath("/app/products", "layout");
  return { success: id ? "Unit saved." : `Added “${rest.name}”.` };
}
