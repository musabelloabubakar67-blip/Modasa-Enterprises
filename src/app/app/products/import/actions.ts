"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { analyzeImport, type ImportAnalysis } from "./analyze";
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS, type ImportRow } from "./columns";

const rowsSchema = z
  .array(
    z
      .object({
        _row: z.number().int(),
        ...Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, z.string().max(2000).optional()])),
      })
      .strict(),
  )
  .min(1, "The file has no rows.")
  .max(MAX_IMPORT_ROWS, `Import at most ${MAX_IMPORT_ROWS} rows at a time.`);

export type PreviewResult = { error?: string; analysis?: Omit<ImportAnalysis, "payload"> };

export async function previewImport(rows: ImportRow[]): Promise<PreviewResult> {
  await requireStaff(["owner", "manager"]);
  const parsed = rowsSchema.safeParse(rows);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { rows: results, summary } = await analyzeImport(await createClient(), parsed.data as ImportRow[]);
  return { analysis: { rows: results, summary } };
}

export type CommitResult = { error?: string; imported?: number };

export async function commitImport(rows: ImportRow[]): Promise<CommitResult> {
  await requireStaff(["owner", "manager"]);
  const parsed = rowsSchema.safeParse(rows);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // Re-check on the server: the data may have changed since the preview.
  const analysis = await analyzeImport(supabase, parsed.data as ImportRow[]);
  if (analysis.summary.errors > 0) return { error: "Some rows have errors. Preview again and fix them first." };

  // New units first, so their products can point at them. They go to the end of the units list.
  const { newUnits } = analysis.summary;
  let payload = analysis.payload;
  let createdUnitIds: string[] = [];
  if (newUnits.length) {
    const { data: last } = await supabase
      .from("units")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: created, error: unitError } = await supabase
      .from("units")
      .insert(newUnits.map((u, i) => ({ ...u, sort_order: (last?.sort_order ?? 0) + i + 1 })))
      .select("id, name");
    if (unitError) return { error: `Nothing was imported: couldn't add the new units (${unitError.message}).` };
    createdUnitIds = created.map((u) => u.id);
    const idByName = new Map(created.map((u) => [u.name.toLowerCase(), u.id]));
    payload = payload.map((p) => {
      const { unit_name, ...product } = p as { unit_name?: string } & Record<string, Json>;
      return unit_name ? { ...product, unit_id: idByName.get(unit_name.toLowerCase()) ?? null } : product;
    });
  }

  const { data, error } = await supabase.rpc("import_products", { products: payload });
  if (error) {
    // Keep it all-or-nothing: take back the units added for this import.
    if (createdUnitIds.length) await supabase.from("units").delete().in("id", createdUnitIds);
    return { error: `Nothing was imported: ${error.message}` };
  }

  revalidatePath("/app/products", "layout");
  return { imported: data };
}
