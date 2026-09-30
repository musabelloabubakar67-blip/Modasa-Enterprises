"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";

export type OpeningRow = { _row: number; location?: string; sku_code?: string; batch?: string; quantity?: string };
export type OpeningRowResult = { row: number; location: string; code: string; quantity: string; messages: string[] };
export type OpeningResult = {
  error?: string;
  rows?: OpeningRowResult[];
  errors?: number;
  byLocation?: { name: string; lines: number }[];
  imported?: { name: string; number: string }[];
};

const rowsSchema = z
  .array(
    z
      .object({
        _row: z.number().int(),
        location: z.string().max(80).optional(),
        sku_code: z.string().max(80).optional(),
        batch: z.string().max(40).optional(),
        quantity: z.string().max(20).optional(),
      })
      .strict(),
  )
  .min(1, "The file has no rows.")
  .max(5000, "Import at most 5000 rows at a time.");

/** Validates an opening-stock sheet; with commit = true, creates one opening adjustment per location. */
export async function importOpeningStock(input: OpeningRow[], commit: boolean): Promise<OpeningResult> {
  await requireStaff(["owner", "manager"]);
  const parsed = rowsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const [locations, skus] = await Promise.all([
    fetchAll((a, b) => supabase.from("locations").select("id, name, code, is_active").range(a, b)),
    fetchAll((a, b) =>
      supabase.from("skus").select("id, code, barcode, products(track_batches, units(allows_decimal))").range(a, b),
    ),
  ]);
  const locationByKey = new Map<string, (typeof locations)[number]>();
  for (const l of locations) {
    locationByKey.set(l.code.toLowerCase(), l);
    locationByKey.set(l.name.toLowerCase(), l);
  }
  const skuByCode = new Map<string, (typeof skus)[number]>();
  for (const s of skus) {
    skuByCode.set(s.code.toLowerCase(), s);
    if (s.barcode) skuByCode.set(s.barcode.toLowerCase(), s);
  }

  const seen = new Map<string, number>();
  const groups = new Map<string, { name: string; lines: { sku_id: string; batch: string; quantity: string }[] }>();
  const rows: OpeningRowResult[] = parsed.data.map((r) => {
    const messages: string[] = [];
    const location = locationByKey.get((r.location ?? "").trim().toLowerCase());
    const sku = skuByCode.get((r.sku_code ?? "").trim().toLowerCase());
    const batch = (r.batch ?? "").trim();
    const qty = (r.quantity ?? "").replace(/,/g, "").trim();

    if (!r.location?.trim()) messages.push("Missing location.");
    else if (!location) messages.push(`Unknown location “${r.location}”. Use a location code like SH1 or WH-A.`);
    else if (!location.is_active) messages.push(`${location.name} is inactive.`);
    if (!r.sku_code?.trim()) messages.push("Missing sku_code.");
    else if (!sku) messages.push(`Unknown sku_code “${r.sku_code}”. Import products first.`);
    if (!/^\d+(\.\d{1,3})?$/.test(qty)) messages.push(`Invalid quantity “${r.quantity ?? ""}”.`);
    else if (sku && !sku.products.units.allows_decimal && !Number.isInteger(Number(qty)))
      messages.push("This item is counted in whole units.");
    if (sku && !sku.products.track_batches && batch)
      messages.push("This item doesn't track batches; leave batch blank.");

    if (location && sku) {
      const key = `${location.id}|${sku.id}|${batch.toLowerCase()}`;
      if (seen.has(key)) messages.push(`Same item, location and batch as row ${seen.get(key)}.`);
      seen.set(key, r._row);
      if (messages.length === 0) {
        const group = groups.get(location.id) ?? { name: location.name, lines: [] };
        group.lines.push({ sku_id: sku.id, batch, quantity: qty });
        groups.set(location.id, group);
      }
    }
    return { row: r._row, location: r.location ?? "", code: r.sku_code ?? "", quantity: r.quantity ?? "", messages };
  });

  const errors = rows.filter((r) => r.messages.length).length;
  const byLocation = [...groups.values()].map((g) => ({ name: g.name, lines: g.lines.length }));
  if (!commit || errors) return { rows, errors, byLocation };

  const imported: { name: string; number: string }[] = [];
  for (const [locationId, group] of groups) {
    const { data: id, error } = await supabase.rpc("submit_adjustment", {
      payload: {
        location_id: locationId,
        kind: "opening",
        note: "Imported opening stock",
        lines: group.lines.map((l) => ({ ...l, quantity: Number(l.quantity) })),
      },
    });
    if (error) {
      revalidatePath("/app/stock", "layout");
      return {
        error: `Stopped at ${group.name}: ${error.message}.${imported.length ? ` Already imported: ${imported.map((i) => i.name).join(", ")}.` : ""}`,
        imported,
      };
    }
    const { data: adj } = await supabase.from("adjustments").select("number").eq("id", id).single();
    imported.push({ name: group.name, number: adj?.number ?? "" });
  }

  revalidatePath("/app/stock", "layout");
  return { imported };
}
