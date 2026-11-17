"use server";

import { getStaff } from "@/lib/auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Off-camera sign-in for the demo tour, so a scene can start as the right person without typing a password
 * on screen. Inert unless the demo tour is switched on, the database is a local one, and the login is one
 * of the demo accounts made by scripts/demo-setup.mjs.
 */
export async function ensureTourUser(who: string): Promise<{ changed: boolean; error?: string }> {
  const password = process.env.DEMO_TOUR_PASSWORD;
  if (
    process.env.NEXT_PUBLIC_DEMO_TOUR !== "1" ||
    !password ||
    !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(env.supabaseUrl) ||
    !/^[a-z]+$/.test(who)
  ) {
    return { changed: false, error: "The demo tour isn't switched on here." };
  }
  const email = `${who}@demo.local`;
  const staff = await getStaff();
  // Already them. A cashier's PIN sign-in counts (it is what a cashier has); anyone else needs their password one.
  if (staff?.email === email && (!staff.tillOnly || staff.realRole === "cashier")) return { changed: false };

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { changed: false, error: `Couldn't sign in as ${email}. Run npm run demo:reset.` };
  return { changed: true };
}
