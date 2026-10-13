import "server-only";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Once an owner exists, setup is never needed again, so this server instance stops asking the database.
// Only "done" is remembered: an unfinished setup is always re-checked, so /setup can't reopen by mistake.
let setupDone = false;

/** First run: true until an owner account exists. */
export async function needsSetup() {
  // Must be checked per request, never baked in at build time.
  await connection();
  if (setupDone) return false;
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner");
  if (error) throw error;
  if (count !== 0) setupDone = true;
  return count === 0;
}
