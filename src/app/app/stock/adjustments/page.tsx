import { formatDate } from "@/lib/dates";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStaffNames } from "@/lib/staff-names";
import { ADJUSTMENT_LABELS, isManager } from "../data";

const STATUS_STYLES = {
  pending: "bg-accent/10 text-accent",
  approved: "bg-success/10 text-success",
  rejected: "bg-danger/10 text-danger",
} as const;

export default async function AdjustmentsPage({ searchParams }: PageProps<"/app/stock/adjustments">) {
  const staff = await requireStaff();
  const { status } = await searchParams;
  const filter = status === "pending" || status === "approved" || status === "rejected" ? status : "";

  const supabase = await createClient();
  let query = supabase
    .from("adjustments")
    .select("id, number, kind, status, note, created_at, created_by, locations(name), adjustment_lines(count)")
    .order("status") // pending first (enum order)
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter) query = query.eq("status", filter);
  const { data: adjustments, error } = await query;
  if (error) throw error;
  const names = await getStaffNames(adjustments.map((a) => a.created_by));
  const manager = isManager(staff.role);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted text-sm">
          Stock counts and write-offs.{" "}
          {manager
            ? "Entries by floor staff wait here for your approval."
            : "A manager approves them before stock changes."}
        </p>
        <div className="flex flex-wrap gap-2">
          {manager && (
            <Link href="/app/stock/adjustments/import" className="btn btn-secondary">
              Import opening stock
            </Link>
          )}
          <Link href="/app/stock/adjustments/new?kind=count" className="btn btn-secondary">
            Stock count
          </Link>
          <Link href="/app/stock/adjustments/new?kind=damage" className="btn btn-primary">
            Write off damage
          </Link>
        </div>
      </div>
      <nav className="flex gap-2 text-sm">
        {[
          ["", "All"],
          ["pending", "Waiting for approval"],
          ["approved", "Approved"],
          ["rejected", "Rejected"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/app/stock/adjustments?status=${value}` : "/app/stock/adjustments"}
            className={`rounded-full px-3 py-1 ${filter === value ? "bg-accent text-accent-foreground" : "bg-surface border-border border"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <ul className="card divide-border divide-y">
        {adjustments.length === 0 && <li className="text-muted p-6 text-center text-sm">Nothing here yet.</li>}
        {adjustments.map((a) => (
          <li key={a.id}>
            <Link href={`/app/stock/adjustments/${a.id}`} className="hover:bg-background flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {ADJUSTMENT_LABELS[a.kind]} <span className="text-muted font-normal">· {a.locations.name}</span>
                </p>
                <p className="text-muted truncate text-sm">
                  {a.number} · {a.adjustment_lines[0]?.count ?? 0} item{a.adjustment_lines[0]?.count === 1 ? "" : "s"} ·{" "}
                  {(a.created_by && names.get(a.created_by)) ?? "System"}
                  {a.note && ` · ${a.note}`}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm">
                <span className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[a.status]}`}>
                  {a.status === "pending" ? "Waiting" : a.status}
                </span>
                <p className="text-muted mt-1 text-xs">{formatDate(a.created_at)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
