import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/roles";

export type Staff = {
  id: string;
  fullName: string;
  email: string;
  /** What the screens allow. A PIN sign-in at the till always gets the cashier's screens. */
  role: StaffRole;
  /** The person's own role, for display. Differs from role only for a PIN sign-in. */
  realRole: StaffRole;
  locationId: string | null;
  locationName: string | null;
  /** Signed in with a till PIN: the till only, at locationId. */
  tillOnly: boolean;
};

type Session = { staff: Staff; locked: boolean; tillLocationId: string | null };

/** The signed-in, active staff member and their session's till state, or null. Cached for one request. */
const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  // getClaims checks the session token's signature locally (no call to the Auth server when the project
  // uses asymmetric signing keys). The profile lookup below still runs on every request, so a deactivated
  // staff member is locked out immediately.
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return null;
  const sessionId = typeof auth.claims.session_id === "string" ? auth.claims.session_id : null;

  const [{ data }, { data: till }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, location_id, is_active, locations(name)")
      .eq("id", userId)
      .maybeSingle(),
    sessionId
      ? supabase
          .from("till_sessions")
          .select("pin, locked_at, location_id, locations(name)")
          .eq("session_id", sessionId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!data || !data.is_active) return null;

  const tillOnly = !!till?.pin;
  return {
    staff: {
      id: data.id,
      fullName: data.full_name,
      email: data.email,
      role: tillOnly ? "cashier" : data.role,
      realRole: data.role,
      locationId: tillOnly ? till.location_id : data.location_id,
      locationName: tillOnly ? (till.locations?.name ?? null) : (data.locations?.name ?? null),
      tillOnly,
    },
    locked: !!till?.locked_at,
    tillLocationId: till?.location_id ?? null,
  };
});

/** The signed-in, active staff member, or null (also while their till is locked). Cached for one request. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const session = await getSession();
  return session && !session.locked ? session.staff : null;
});

/** For the locked-till screen: who was signed in and at which shop, while the till is locked. */
export async function getLockedTill() {
  const session = await getSession();
  return session?.locked ? { staff: session.staff, locationId: session.tillLocationId } : null;
}

/** Use at the top of staff pages and server actions. Redirects if not allowed. */
export async function requireStaff(allowed?: readonly StaffRole[]): Promise<Staff> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.locked) redirect("/locked");
  const staff = session.staff;
  if (allowed && !allowed.includes(staff.role)) redirect("/app?denied=1");
  return staff;
}
