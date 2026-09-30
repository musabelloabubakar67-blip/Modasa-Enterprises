import "server-only";
import type { Staff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Counts of things waiting for this person, shown next to menu items. */
export async function getNavBadges(staff: Staff): Promise<Record<string, number>> {
  const supabase = await createClient();
  const manager = staff.role === "owner" || staff.role === "manager";
  const here = staff.locationId;

  const transfers = supabase.from("transfers").select("id", { count: "exact", head: true });
  const transferQuery = manager
    ? transfers.or("status.in.(requested,dispatched),and(has_shortage.eq.true,shortage_resolved_at.is.null)")
    : here
      ? transfers.or(
          `and(status.eq.requested,from_location_id.eq.${here}),and(status.eq.dispatched,to_location_id.eq.${here})`,
        )
      : null;

  const [transferCount, adjustmentCount] = await Promise.all([
    transferQuery,
    manager ? supabase.from("adjustments").select("id", { count: "exact", head: true }).eq("status", "pending") : null,
  ]);

  return {
    "/app/transfers": transferCount?.count ?? 0,
    "/app/stock": adjustmentCount?.count ?? 0,
  };
}
