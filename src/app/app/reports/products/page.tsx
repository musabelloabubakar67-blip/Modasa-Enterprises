import Link from "next/link";
import { getBusinessSettings } from "@/lib/business";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatQty } from "@/lib/quantity";
import { parseReportFilters, products, slowMovers } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";
import { BarList } from "@/components/charts/bar-list";
import { getActiveLocations } from "../../stock/data";
import { filterQuery, ReportFilterBar } from "../filters";

const SLOW_DAYS = [14, 30, 60, 90];

export default async function ProductsReportPage({ searchParams }: PageProps<"/app/reports/products">) {
  const params = await searchParams;
  const f = parseReportFilters(params);
  const slowDays = SLOW_DAYS.includes(Number(params.days)) ? Number(params.days) : 30;
  const supabase = await createClient();
  const [locations, rows, slow, { currency }] = await Promise.all([
    getActiveLocations(),
    products(supabase, f),
    slowMovers(supabase, slowDays, f.shop),
    getBusinessSettings(),
  ]);
  const money = (k: number) => formatMoney(k, currency);
  const shops = locations.filter((l) => l.kind === "shop");
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  const byCategory = new Map<string, { revenue: number; quantity: number }>();
  for (const r of rows) {
    const c = byCategory.get(r.category_name) ?? { revenue: 0, quantity: 0 };
    c.revenue += Number(r.revenue_kobo);
    c.quantity += Number(r.quantity);
    byCategory.set(r.category_name, c);
  }
  const total = rows.reduce((s, r) => s + Number(r.revenue_kobo), 0);
  const slowValue = slow.reduce((s, r) => s + Number(r.quantity) * (r.cost_kobo ?? 0), 0);

  return (
    <>
      <ReportFilterBar
        filters={f}
        shops={shops}
        exportHref={`/app/reports/export?${filterQuery(f, { report: "products" })}`}
        extra={<input type="hidden" name="days" value={slowDays} />}
      />
      <p className="text-muted text-sm">
        {formatDate(f.from)} – {formatDate(f.to)} · net of returns
      </p>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Best sellers by takings</h2>
          <BarList
            currency={currency}
            rows={rows.slice(0, 10).map((r) => ({
              key: r.sku_id,
              label: r.product_name,
              detail: [r.variant_label, `${formatQty(Number(r.quantity))} ${r.unit}`].filter(Boolean).join(" · "),
              value: Number(r.revenue_kobo),
              href: `/app/stock/${r.sku_id}`,
            }))}
          />
        </section>
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">By category</h2>
          <BarList
            currency={currency}
            color="var(--series-2)"
            rows={[...byCategory.entries()]
              .sort((a, b) => b[1].revenue - a[1].revenue)
              .map(([name, c]) => ({
                key: name,
                label: name,
                detail: total ? `${Math.round((c.revenue / total) * 100)}%` : undefined,
                value: c.revenue,
              }))}
          />
        </section>
      </div>

      <section className="card overflow-x-auto p-4">
        <h2 className="mb-3 font-semibold">All items sold ({rows.length})</h2>
        <table className="w-full text-sm">
          <thead className="text-muted text-left">
            <tr>
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 font-medium">Category</th>
              <th className="pb-2 text-right font-medium">Sold</th>
              <th className="pb-2 text-right font-medium">Takings</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((r) => (
              <tr key={r.sku_id}>
                <td className="py-2">
                  <Link href={`/app/stock/${r.sku_id}`} className="hover:underline">
                    {r.product_name}
                    {r.variant_label && ` · ${r.variant_label}`}
                  </Link>
                  <span className="text-muted ml-2 font-mono text-xs">{r.code}</span>
                </td>
                <td className="py-2">{r.category_name}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatQty(Number(r.quantity))} {r.unit}
                </td>
                <td className="py-2 text-right font-medium tabular-nums">{money(Number(r.revenue_kobo))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            Slow movers: in stock, not sold in {slowDays} days
            {f.shop ? ` at ${locationName.get(f.shop)}` : ""}
          </h2>
          <nav className="flex gap-1 text-xs">
            {SLOW_DAYS.map((d) => (
              <Link
                key={d}
                href={`/app/reports/products?${filterQuery(f, { days: String(d) })}`}
                className={`rounded-full px-2.5 py-1 ${d === slowDays ? "bg-accent text-accent-foreground" : "bg-background"}`}
              >
                {d} days
              </Link>
            ))}
          </nav>
        </div>
        <p className="text-muted mb-3 text-sm">
          {slow.length} item lines tying up about {money(slowValue)} at cost. Consider a sale price, moving them to a
          busier shop, or not reordering.
        </p>
        <table className="w-full text-sm">
          <thead className="text-muted text-left">
            <tr>
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 font-medium">Where</th>
              <th className="pb-2 text-right font-medium">In stock</th>
              <th className="pb-2 text-right font-medium">Value at cost</th>
              <th className="pb-2 text-right font-medium">Last sold</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {slow.slice(0, 100).map((r) => (
              <tr key={`${r.sku_id}-${r.location_id}`}>
                <td className="py-2">
                  <Link href={`/app/stock/${r.sku_id}`} className="hover:underline">
                    {r.product_name}
                    {r.variant_label && ` · ${r.variant_label}`}
                  </Link>
                </td>
                <td className="py-2">{locationName.get(r.location_id) ?? "—"}</td>
                <td className="py-2 text-right tabular-nums">{formatQty(Number(r.quantity))}</td>
                <td className="py-2 text-right tabular-nums">
                  {r.cost_kobo !== null ? money(Math.round(Number(r.quantity) * r.cost_kobo)) : "no cost"}
                </td>
                <td className="py-2 text-right">{r.last_sold_at ? formatDate(r.last_sold_at) : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
