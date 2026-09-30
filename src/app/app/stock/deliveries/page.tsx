import { formatDate } from "@/lib/dates";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const STATUS_STYLES = {
  draft: "bg-background text-muted",
  posted: "bg-success/10 text-success",
  cancelled: "bg-danger/10 text-danger",
} as const;

export default async function DeliveriesPage({ searchParams }: PageProps<"/app/stock/deliveries">) {
  await requireStaff(["owner", "manager", "warehouse"]);
  const { status } = await searchParams;
  const filter = status === "draft" || status === "posted" || status === "cancelled" ? status : "";

  const supabase = await createClient();
  let query = supabase
    .from("receipts")
    .select("id, number, status, supplier_name, supplier_reference, received_on, locations(name), receipt_lines(count)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter) query = query.eq("status", filter);
  const { data: receipts, error } = await query;
  if (error) throw error;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted text-sm">
          Goods arriving from suppliers. Deliveries can only be received at a warehouse.
        </p>
        <Link href="/app/stock/deliveries/new" className="btn btn-primary">
          New delivery
        </Link>
      </div>
      <nav className="flex gap-2 text-sm">
        {[
          ["", "All"],
          ["draft", "Drafts"],
          ["posted", "Posted"],
          ["cancelled", "Cancelled"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/app/stock/deliveries?status=${value}` : "/app/stock/deliveries"}
            className={`rounded-full px-3 py-1 ${filter === value ? "bg-accent text-accent-foreground" : "bg-surface border-border border"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <ul className="card divide-border divide-y">
        {receipts.length === 0 && <li className="text-muted p-6 text-center text-sm">No deliveries yet.</li>}
        {receipts.map((r) => (
          <li key={r.id}>
            <Link href={`/app/stock/deliveries/${r.id}`} className="hover:bg-background flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {r.number} <span className="text-muted font-normal">· {r.locations.name}</span>
                </p>
                <p className="text-muted truncate text-sm">
                  {[r.supplier_name, r.supplier_reference].filter(Boolean).join(" · ") || "No supplier recorded"} ·{" "}
                  {r.receipt_lines[0]?.count ?? 0} item line{r.receipt_lines[0]?.count === 1 ? "" : "s"}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm">
                <span className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                <p className="text-muted mt-1 text-xs">{formatDate(r.received_on)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
