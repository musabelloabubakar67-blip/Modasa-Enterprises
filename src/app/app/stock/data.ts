import "server-only";
import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffRole } from "@/lib/roles";

export type LocationSummary = { id: string; name: string; code: string; kind: "shop" | "warehouse" };

const LOCATIONS_TAG = "locations";

/**
 * Active locations. Every active staff member may read all of them (see the locations policies), and
 * they rarely change, so the list is kept between requests; saving a location calls expireLocations().
 * Only call after checking the visitor is staff (requireStaff), as every staff page already does.
 */
export const getActiveLocations = cache(
  unstable_cache(
    async (): Promise<LocationSummary[]> => {
      const { data, error } = await createAdminClient()
        .from("locations")
        .select("id, name, code, kind")
        .eq("is_active", true)
        .order("kind", { ascending: false }) // warehouses first: stock flows from them to shops
        .order("name");
      if (error) throw error;
      return data;
    },
    [LOCATIONS_TAG],
    { tags: [LOCATIONS_TAG], revalidate: 3600 },
  ),
);

/** Call after adding or changing a location. */
export function expireLocations() {
  revalidateTag(LOCATIONS_TAG, { expire: 0 });
}

export const isManager = (role: StaffRole) => role === "owner" || role === "manager";

export { formatQty } from "@/lib/quantity";

export { MOVEMENT_LABELS, ADJUSTMENT_LABELS } from "./labels";
