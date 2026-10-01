import { PRESETS, type ReportFilters } from "@/lib/reports";
import type { LocationSummary } from "../stock/data";

/** One row of filters above every report. A plain GET form, so a report's URL can be bookmarked or shared. */
export function ReportFilterBar({
  filters,
  shops,
  extra,
  exportHref,
}: {
  filters: ReportFilters;
  shops: LocationSummary[];
  extra?: React.ReactNode;
  exportHref?: string;
}) {
  return (
    <form className="card flex flex-wrap items-end gap-2 p-3 print:hidden">
      <label>
        <span className="label text-xs">Period</span>
        <select name="preset" defaultValue={filters.preset ?? ""} className="input w-auto">
          {Object.entries(PRESETS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          <option value="">Custom dates →</option>
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
      <label>
        <span className="label text-xs">Shop</span>
        <select name="shop" defaultValue={filters.shop ?? ""} className="input w-auto">
          <option value="">All shops</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {extra}
      <button type="submit" className="btn btn-primary">
        Show
      </button>
      {exportHref && (
        <a href={exportHref} className="btn btn-secondary ml-auto" download>
          Export CSV
        </a>
      )}
      <p className="text-muted w-full text-xs">
        Choose a period, or pick &ldquo;Custom dates&rdquo; and set From and To.
      </p>
    </form>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-muted text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {note && <p className="text-muted mt-1 text-xs">{note}</p>}
    </div>
  );
}

/** Query string for links/exports that keep the current filters. */
export function filterQuery(f: ReportFilters, extra: Record<string, string> = {}) {
  const sp = new URLSearchParams();
  if (f.preset) sp.set("preset", f.preset);
  else {
    sp.set("from", f.from);
    sp.set("to", f.to);
  }
  if (f.shop) sp.set("shop", f.shop);
  for (const [k, v] of Object.entries(extra)) sp.set(k, v);
  return sp.toString();
}
