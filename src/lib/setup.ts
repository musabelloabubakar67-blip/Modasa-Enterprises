import "server-only";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** First run: true until an owner account exists. */
export async function needsSetup() {
  // Must be checked per request, never baked in at build time.
  await connection();
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner");
  if (error) throw error;
  return count === 0;
}
