import { requireStaff } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { LimitForm } from "./limit-form";

/**
 * How much discount each person may give at the till, as a percentage of the items. The owner sets anyone's
 * and has no limit; managers set cashiers'. Changes are in the security log.
 */
export default async function DiscountLimitsPage() {
  const me = await requireStaff(["owner", "manager"]);
  const supabase = await createClient();
  const { data: staff, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, discount_limit_pct, locations(name)")
    .eq("is_active", true)
    .in("role", me.role === "owner" ? ["manager", "cashier"] : ["cashier"])
    .order("role")
    .order("full_name");
  if (error) throw error;

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-muted text-sm">
        The most discount each person may give at the till, as a percentage of the items. A discount above it is
        refused, every discount needs a reason, and none can go below cost unless the owner gives it.{" "}
        {me.role === "owner" ? "You have no limit." : "The owner sets managers' limits."}
      </p>
      {staff.length === 0 ? (
        <p className="card text-muted p-6 text-center text-sm">No staff to set limits for yet.</p>
      ) : (
        <ul className="card divide-border divide-y">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="font-medium">{s.full_name}</p>
                <p className="text-muted text-xs">
                  {ROLE_LABELS[s.role]}
                  {s.locations?.name && ` · ${s.locations.name}`}
                </p>
              </div>
              <LimitForm id={s.id} pct={Number(s.discount_limit_pct)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
