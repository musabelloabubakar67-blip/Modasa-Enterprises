import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { isManager } from "../stock/data";
import { STATUS_LABELS, STATUS_STYLES } from "./labels";

const VIEWS = {
  action: "Needs action",
  transit: "In transit",
  requested: "Requested",
  done: "Completed",
  shortage: "Shortages",
  cancelled: "Cancelled",
} as const;
type View = keyof typeof VIEWS;

export default async function TransfersPage({ searchParams }: PageProps<"/app/transfers">) {
  const staff = await requireStaff();
  const params = await searchParams;
  const view: View = typeof params.view === "string" && params.view in VIEWS ? (params.view as View) : "action";
  const manager = isManager(staff.role);
  const mine = staff.locationId;

  const supabase = await createClient();
  let query = supabase
    .from("transfers")
    .select(
      `id, number, status, note, requested_at, dispatched_at, received_at, has_shortage, shortage_resolved_at,
       from_location_id, to_location_id, from:locations!transfers_from_location_id_fkey(name),
       to:locations!transfers_to_location_id_fkey(name), transfer_lines(count)`,
    )
    .order("requested_at", { ascending: false })
    .limit(100);

  // Floor staff only ever see transfers involving their own location.
  if (!manager && mine) query = query.or(`from_location_id.eq.${mine},to_location_id.eq.${mine}`);

  if (view === "action") {
    if (manager) query = query.in("status", ["requested", "dispatched"]);
    else if (mine)
      query = query.or(
        `and(status.eq.requested,from_location_id.eq.${mine}),and(status.eq.dispatched,to_location_id.eq.${mine})`,
      );
  } else if (view === "transit") query = query.eq("status", "dispatched");
  else if (view === "requested") query = query.eq("status", "requested");
  else if (view === "done") query = query.eq("status", "received");
  else if (view === "cancelled") query = query.eq("status", "cancelled");
  else if (view === "shortage") query = query.eq("has_shortage", true).is("shortage_resolved_at", null);

  const { data: transfers, error } = await query;
  if (error) throw error;

  const actionFor = (t: (typeof transfers)[number]) => {
    const atSource = manager || t.from_location_id === mine;
    const atDest = manager || t.to_location_id === mine;
    if (t.status === "requested" && atSource) return "Send";
    if (t.status === "dispatched" && atDest) return "Receive";
    if (t.has_shortage && !t.shortage_resolved_at && manager) return "Resolve shortage";
    return null;
  };

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Transfers</h1>
        <Link href="/app/transfers/new" className="btn btn-primary">
          New transfer
        </Link>
      </div>
      <nav className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(VIEWS) as View[])
          .filter((v) => v !== "shortage" || manager)
          .map((v) => (
            <Link
              key={v}
              href={v === "action" ? "/app/transfers" : `/app/transfers?view=${v}`}
              className={`rounded-full px-3 py-1 ${view === v ? "bg-accent text-accent-foreground" : "bg-surface border-border border"}`}
            >
              {VIEWS[v]}
            </Link>
          ))}
      </nav>

      <ul className="card divide-border divide-y">
        {transfers.length === 0 && (
          <li className="text-muted p-6 text-center text-sm">
            {view === "action" ? "Nothing waiting for you." : "No transfers here."}
          </li>
        )}
        {transfers.map((t) => {
          const action = actionFor(t);
          const lines = t.transfer_lines[0]?.count ?? 0;
          return (
            <li key={t.id}>
              <Link href={`/app/transfers/${t.id}`} className="hover:bg-background flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {t.from.name} → {t.to.name}
                  </p>
                  <p className="text-muted truncate text-sm">
                    {t.number} · {lines} item{lines === 1 ? "" : "s"} · {formatDateTime(t.requested_at)}
                    {t.note && ` · ${t.note}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  <span className={`rounded px-2 py-0.5 ${STATUS_STYLES[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                  {t.has_shortage && !t.shortage_resolved_at && (
                    <span className="bg-danger/10 text-danger rounded px-2 py-0.5">Shortage</span>
                  )}
                  {action && <span className="text-accent font-medium">{action} →</span>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
