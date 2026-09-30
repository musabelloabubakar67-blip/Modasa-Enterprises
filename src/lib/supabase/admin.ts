import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { env, serverEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses row-level security, so only use it in server code after
 * checking the caller's permissions (e.g. creating staff accounts, first-run setup).
 */
export function createAdminClient() {
  return createClient<Database>(env.supabaseUrl, serverEnv().supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
