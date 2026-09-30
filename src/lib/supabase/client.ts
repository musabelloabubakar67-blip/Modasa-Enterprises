import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { env } from "@/lib/env";

/** Browser Supabase client, signed in as the current staff member. Row-level security applies. */
export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabasePublishableKey);
}
