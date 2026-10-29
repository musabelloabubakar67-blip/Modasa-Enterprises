import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SecurityCategory = "access" | "money" | "stock" | "settings";

/**
 * Adds a line to the owner's security log for actions done with the service key, which the database
 * triggers can't attribute (creating logins, resetting passwords, the training reset). Most lines are
 * written by triggers; see supabase/migrations/20261028000019_security_log.sql.
 *
 * Never throws: a logging hiccup must not undo or block the action itself.
 */
export async function logSecurity(
  actorId: string,
  category: SecurityCategory,
  action: string,
  summary: string,
  locationId?: string | null,
) {
  const { error } = await createAdminClient().rpc("security_log_add", {
    p_actor: actorId,
    p_category: category,
    p_action: action,
    p_summary: summary,
    p_location: locationId ?? null,
  });
  if (error) console.error("security log:", error.message);
}

/** Failed and blocked sign-ins. Repeats for the same email within an hour become one line with a count. */
export async function logFailedSignIn(email: string, reason: "failed_sign_in" | "deactivated_sign_in") {
  const { error } = await createAdminClient().rpc("security_log_failed_sign_in", { p_email: email, p_reason: reason });
  if (error) console.error("security log:", error.message);
}
