import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStaffNames } from "@/lib/staff-names";
import { getActiveLocations, MOVEMENT_LABELS } from "../data";
import { MovementList } from "../movement-list";
import { historyQuery, MOVEMENT_TYPES, parseHistoryFilters } from "./query";

const PAGE_SIZE = 100;

export default async function HistoryPage({ searchParams }: PageProps<"/app/stock/history">) {
  await requireStaff();
  const params = await searchParams;
  const filters = parseHistoryFilters(params);
  const page = Math.max(1, Number(params.page) || 1);

  const supabase = await createClient();
  const [locations, { data: movements, count, error }] = await Promise.all([
    getActiveLocations(),
    historyQuery(supabase, filters).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ]);
  if (error) throw error;
  const names = await getStaffNames(movements.map((m) => m.created_by));

  let skuName: string | null = null;
  if (filters.sku) {
    const { data } = await supabase
      .from("skus")
      .select("code, variant_label, products(name)")
      .eq("id", filters.sku)
      .maybeSingle();
    if (data) skuName = `${data.products.name}${data.variant_label ? ` · ${data.variant_label}` : ""} (${data.code})`;
  }

  const qs = (extra: Record<string, string>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, ...extra })) if (v) sp.set(k, String(v));
    return sp.toString();
  };
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2">
        {filters.sku && <input type="hidden" name="sku" value={filters.sku} />}
        <label>
          <span className="label text-xs">Location</span>
          <select name="location" defaultValue={filters.location ?? ""} className="input w-auto">
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label text-xs">Type</span>
          <select name="type" defaultValue={filters.type ?? ""} className="input w-auto">
            <option value="">All types</option>
            {MOVEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {MOVEMENT_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label text-xs">From</span>
          <input type="date" name="from" defaultValue={filters.from} className="input w-auto" />
        </label>
        <label>
          <span className="label text-xs">To</span>
          <input type="date" name="to" defaultValue={filters.to} className="input w-auto" />
        </label>
        <button type="submit" className="btn btn-secondary">
          Filter
        </button>
        {/* Route handler download, not a page. */}
        <a href={`/app/stock/history/export?${qs({})}`} className="btn btn-secondary ml-auto" download>
          Export CSV
        </a>
      </form>

      {skuName && (
        <p className="text-sm">
          Showing only <strong>{skuName}</strong> ·{" "}
          <Link href={`/app/stock/history?${qs({ sku: "" })}`} className="text-accent hover:underline">
            show all items
          </Link>
        </p>
      )}
      <p className="text-muted text-sm">{count ?? 0} movements</p>
      <MovementList movements={movements} showBatch showItem={!filters.sku} names={names} />

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? (
            <Link href={`/app/stock/history?${qs({ page: String(page - 1) })}`} className="btn btn-secondary">
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/app/stock/history?${qs({ page: String(page + 1) })}`} className="btn btn-secondary">
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
