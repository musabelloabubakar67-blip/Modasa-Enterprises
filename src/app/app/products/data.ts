import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Category, Unit } from "@/lib/products";

export async function getCatalogueOptions(): Promise<{ categories: Category[]; units: Unit[] }> {
  const supabase = await createClient();
  const [categories, units] = await Promise.all([
    supabase.from("categories").select("id, name, is_active").order("sort_order").order("name"),
    supabase.from("units").select("id, name, abbreviation, allows_decimal, coverage").order("sort_order").order("name"),
  ]);
  if (categories.error) throw categories.error;
  if (units.error) throw units.error;
  return { categories: categories.data, units: units.data };
}
