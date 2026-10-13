import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/roles";

export type Staff = {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  locationId: string | null;
  locationName: string | null;
};

/** The signed-in, active staff member, or null. Cached for the duration of one request. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const supabase = await createClient();
  // getClaims checks the session token's signature locally (no call to the Auth server when the project
  // uses asymmetric signing keys). The profile lookup below still runs on every request, so a deactivated
  // staff member is locked out immediately.
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, location_id, is_active, locations(name)")
    .eq("id", userId)
    .maybeSingle();

  if (!data || !data.is_active) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    role: data.role,
    locationId: data.location_id,
    locationName: data.locations?.name ?? null,
  };
});

/** Use at the top of staff pages and server actions. Redirects if not allowed. */
export async function requireStaff(allowed?: readonly StaffRole[]): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  if (allowed && !allowed.includes(staff.role)) redirect("/app?denied=1");
  return staff;
}
