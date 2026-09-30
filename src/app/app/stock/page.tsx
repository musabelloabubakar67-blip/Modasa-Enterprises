import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { formatQty, getActiveLocations, isManager } from "./data";

const PAGE_SIZE = 50;

export default async function StockOverviewPage({ searchParams }: PageProps<"/app/stock">) {
  const staff = await requireStaff();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const category = typeof params.category === "string" ? params.category : "";
  const show = params.show === "low" || params.show === "out" ? params.show : "all";
  const page = Math.max(1, Number(params.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("stock_overview")
    .select("sku_id, code, variant_label, product_id, product_name, unit, track_batches, total_quantity, is_low", {
      count: "exact",
    })
    .order("product_name")
    .order("sort_order")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("search_text", `%${q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (category) query = query.eq("category_id", category);
  if (show === "low") query = query.eq("is_low", true);
  if (show === "out") query = query.lte("total_quantity", 0);

  const [locations, { data: rows, count, error }, { data: categories }] = await Promise.all([
    getActiveLocations(),
    query,
    supabase.from("categories").select("id, name").order("sort_order").order("name"),
  ]);
  if (error) throw error;

  const skuIds = rows.map((r) => r.sku_id!);
  const [{ data: levels }, { data: reorders }] = await Promise.all([
    supabase.from("sku_location_stock").select("sku_id, location_id, quantity").in("sku_id", skuIds),
    supabase.from("reorder_levels").select("sku_id, location_id, reorder_level").in("sku_id", skuIds),
  ]);
  const qty = new Map(levels?.map((l) => [`${l.sku_id}|${l.location_id}`, Number(l.quantity)]));
  const reorder = new Map(reorders?.map((r) => [`${r.sku_id}|${r.location_id}`, Number(r.reorder_level)]));

  const manager = isManager(staff.role);
  const stockValue = manager ? await getStockValue(locations.map((l) => l.id)) : null;
  const { currency } = await getBusinessSettings();

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (overrides: { page: number }) => {
    const sp = new URLSearchParams();
    const merged = {
      q,
      category,
      show: show === "all" ? "" : show,
      page: overrides.page > 1 ? String(overrides.page) : "",
    };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return `/app/stock${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-4">
      {stockValue && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {locations.map((l) => (
            <div key={l.id} className="card p-3">
              <p className="text-muted truncate text-xs">{l.name}</p>
              <p className="font-semibold tabular-nums">
                {formatMoney(stockValue.byLocation.get(l.id) ?? 0, currency)}
              </p>
            </div>
          ))}
          <div className="card bg-accent/5 p-3">
            <p className="text-muted text-xs">Total stock value (at cost)</p>
            <p className="font-semibold tabular-nums">{formatMoney(stockValue.total, currency)}</p>
          </div>
        </div>
      )}
      {stockValue && stockValue.uncosted > 0 && (
        <p className="text-muted text-xs">
          {stockValue.uncosted} SKU{stockValue.uncosted === 1 ? "" : "s"} in stock have no cost price and aren&apos;t
          included in the value.
        </p>
      )}

      <form className="flex flex-wrap gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, code or barcode"
          className="input max-w-xs flex-1"
          aria-label="Search stock"
        />
        <select name="category" defaultValue={category} className="input w-auto" aria-label="Category">
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="show" defaultValue={show} className="input w-auto" aria-label="Show">
          <option value="all">All items</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock everywhere</option>
        </select>
        <button type="submit" className="btn btn-secondary">
          Filter
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted border-border border-b text-left">
            <tr>
              <th className="p-3 font-medium">Item</th>
              {locations.map((l) => (
                <th key={l.id} className="p-3 text-right font-medium whitespace-nowrap" title={l.name}>
                  {l.code}
                </th>
              ))}
              <th className="p-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={locations.length + 2} className="text-muted p-6 text-center">
                  No items match.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.sku_id} className="hover:bg-background">
                <td className="p-3">
                  <Link href={`/app/stock/${row.sku_id}`} className="hover:underline">
                    <span className="font-medium">{row.product_name}</span>
                    {row.variant_label && <span> · {row.variant_label}</span>}
                  </Link>
                  <p className="text-muted font-mono text-xs">
                    {row.code}
                    {row.track_batches && <span className="ml-2 font-sans">· by batch</span>}
                  </p>
                </td>
                {locations.map((l) => {
                  const key = `${row.sku_id}|${l.id}`;
                  const value = qty.get(key) ?? 0;
                  const min = reorder.get(key);
                  const low = min !== undefined && value <= min;
                  return (
                    <td
                      key={l.id}
                      className={`p-3 text-right tabular-nums ${value === 0 ? "text-muted/60" : ""} ${low ? "text-danger font-semibold" : ""}`}
                      title={low ? `At or below reorder level (${formatQty(min)})` : undefined}
                    >
                      {value === 0 ? "–" : formatQty(value)}
                    </td>
                  );
                })}
                <td className="p-3 text-right font-medium tabular-nums">
                  {formatQty(Number(row.total_quantity))} <span className="text-muted text-xs">{row.unit}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted text-xs">
        Red = at or below the reorder level for that location. Open an item to see batches, history and set reorder
        levels.
      </p>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className="btn btn-secondary">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={href({ page: page + 1 })} className="btn btn-secondary">
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

/** Stock value at cost per location. Only called for owners/managers (costs are hidden from others anyway). */
async function getStockValue(locationIds: string[]) {
  const supabase = await createClient();
  const [levels, costs] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("sku_location_stock")
        .select("sku_id, location_id, quantity")
        .in("location_id", locationIds)
        .range(from, to),
    ),
    fetchAll((from, to) => supabase.from("sku_costs").select("sku_id, cost_kobo").range(from, to)),
  ]);
  const cost = new Map(costs.map((c) => [c.sku_id, c.cost_kobo]));
  const byLocation = new Map<string, number>();
  const uncosted = new Set<string>();
  let total = 0;
  for (const l of levels) {
    const q = Number(l.quantity);
    if (q <= 0) continue;
    const c = cost.get(l.sku_id!);
    if (c === undefined) {
      uncosted.add(l.sku_id!);
      continue;
    }
    const value = Math.round(q * c);
    byLocation.set(l.location_id!, (byLocation.get(l.location_id!) ?? 0) + value);
    total += value;
  }
  return { byLocation, total, uncosted: uncosted.size };
}
