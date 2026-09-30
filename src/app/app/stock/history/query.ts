import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const MOVEMENT_TYPES = [
  "opening",
  "receipt",
  "transfer_out",
  "transfer_in",
  "sale",
  "return",
  "damage",
  "count_correction",
] as const;

const filtersSchema = z.object({
  sku: z.uuid().optional().catch(undefined),
  location: z.uuid().optional().catch(undefined),
  type: z.enum(MOVEMENT_TYPES).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
});

export type HistoryFilters = z.infer<typeof filtersSchema>;

export function parseHistoryFilters(params: Record<string, string | string[] | undefined>): HistoryFilters {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined]),
  );
  return filtersSchema.parse(flat);
}

/**
 * Movement query with the history filters applied. Dates are whole days in Lagos time (UTC+1).
 * Synchronous on purpose: query builders are thenable, so returning one from an async function would run it.
 */
export function historyQuery(supabase: Awaited<ReturnType<typeof createClient>>, filters: HistoryFilters) {
  let query = supabase
    .from("stock_movements")
    .select(
      "id, created_at, type, quantity, batch, note, created_by, locations(code, name), skus(code, variant_label, products(name))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (filters.sku) query = query.eq("sku_id", filters.sku);
  if (filters.location) query = query.eq("location_id", filters.location);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00+01:00`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59.999+01:00`);
  return query;
}
