import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/roles";

export type LocationSummary = { id: string; name: string; code: string; kind: "shop" | "warehouse" };

export async function getActiveLocations(): Promise<LocationSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, code, kind")
    .eq("is_active", true)
    .order("kind", { ascending: false }) // warehouses first: stock flows from them to shops
    .order("name");
  if (error) throw error;
  return data;
}

export const isManager = (role: StaffRole) => role === "owner" || role === "manager";

export { formatQty } from "@/lib/quantity";

export { MOVEMENT_LABELS, ADJUSTMENT_LABELS } from "./labels";
