import { getBusinessSettings } from "@/lib/business";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatQty } from "@/lib/quantity";
import { marginPercent, parseReportFilters, products } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";
import { getActiveLocations } from "../../stock/data";
import { filterQuery, ReportFilterBar, Stat } from "../filters";

type Row = Awaited<ReturnType<typeof products>>[number];

function totals(rows: Row[]) {
  const revenue = rows.reduce((s, r) => s + Number(r.revenue_kobo), 0);
  const costedRevenue = rows.reduce((s, r) => s + Number(r.costed_revenue_kobo), 0);
  const cost = rows.reduce((s, r) => s + Number(r.cost_kobo), 0);
  return { revenue, costedRevenue, cost, profit: costedRevenue - cost, uncosted: revenue - costedRevenue };
}

export default async function ProfitReportPage({ searchParams }: PageProps<"/app/reports/profit">) {
  const f = parseReportFilters(await searchParams);
  const supabase = await createClient();
  const [locations, { currency }] = await Promise.all([getActiveLocations(), getBusinessSettings()]);
  const shops = locations.filter((l) => l.kind === "shop");
  const shown = f.shop ? shops.filter((s) => s.id === f.shop) : shops;
  const perShop = await Promise.all(
    shown.map(async (s) => ({ shop: s, rows: await products(supabase, { ...f, shop: s.id }) })),
  );
  const all = perShop.flatMap((p) => p.rows);
  const money = (k: number) => formatMoney(k, currency);
  const t = totals(all);
  const margin = marginPercent(t.costedRevenue, t.cost);

  // Combine per-shop rows into per-item and per-category totals.
  const byItem = new Map<string, Row[]>();
  const byCategory = new Map<string, Row[]>();
  for (const r of all) {
    byItem.set(r.sku_id, [...(byItem.get(r.sku_id) ?? []), r]);
    byCategory.set(r.category_name, [...(byCategory.get(r.category_name) ?? []), r]);
  }
  const items = [...byItem.values()]
    .map((rows) => ({ row: rows[0], qty: rows.reduce((s, r) => s + Number(r.quantity), 0), ...totals(rows) }))
    .sort((a, b) => b.profit - a.profit);

  return (
    <>
      <ReportFilterBar
        filters={f}
        shops={shops}
        exportHref={`/app/reports/export?${filterQuery(f, { report: "profit" })}`}
      />
      <p className="text-muted text-sm">
        {formatDate(f.from)} – {formatDate(f.to)} · gross profit = takings − cost price at the time of each sale, net of
        returns
      </p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Takings" value={money(t.revenue)} />
        <Stat label="Cost of goods sold" value={money(t.cost)} />
        <Stat label="Gross profit" value={money(t.profit)} />
        <Stat label="Gross margin" value={margin === null ? "–" : `${margin}%`} />
      </section>
      {t.uncosted > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {money(t.uncosted)} of takings ({Math.round((t.uncosted / t.revenue) * 100)}%) were for items with no cost
          price recorded at the time, so they&apos;re left out of profit and margin. Add cost prices on the products (or
          enter unit costs when receiving deliveries) to include them.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfitTable
          title="By shop"
          money={money}
          rows={perShop.map((p) => ({ key: p.shop.id, label: p.shop.name, ...totals(p.rows) }))}
        />
        <ProfitTable
          title="By category"
          money={money}
          rows={[...byCategory.entries()]
            .map(([name, rows]) => ({ key: name, label: name, ...totals(rows) }))
            .sort((a, b) => b.profit - a.profit)}
        />
      </div>

      <section className="card overflow-x-auto p-4">
        <h2 className="mb-3 font-semibold">By item</h2>
        <table className="w-full text-sm">
          <thead className="text-muted text-left">
            <tr>
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 text-right font-medium">Sold</th>
              <th className="pb-2 text-right font-medium">Takings</th>
              <th className="pb-2 text-right font-medium">Cost</th>
              <th className="pb-2 text-right font-medium">Profit</th>
              <th className="pb-2 text-right font-medium">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {items.map((i) => {
              const m = marginPercent(i.costedRevenue, i.cost);
              return (
                <tr key={i.row.sku_id}>
                  <td className="py-2">
                    {i.row.product_name}
                    {i.row.variant_label && ` · ${i.row.variant_label}`}
                    <span className="text-muted ml-2 font-mono text-xs">{i.row.code}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatQty(i.qty)} {i.row.unit}
                  </td>
                  <td className="py-2 text-right tabular-nums">{money(i.revenue)}</td>
                  <td className="py-2 text-right tabular-nums">{i.costedRevenue ? money(i.cost) : "no cost"}</td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {i.costedRevenue ? money(i.profit) : "–"}
                  </td>
                  <td className={`py-2 text-right tabular-nums ${m !== null && m < 15 ? "text-danger" : ""}`}>
                    {m === null ? "–" : `${m}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-muted mt-3 text-xs">Margins under 15% are highlighted.</p>
      </section>
    </>
  );
}

function ProfitTable({
  title,
  rows,
  money,
}: {
  title: string;
  rows: { key: string; label: string; revenue: number; costedRevenue: number; cost: number; profit: number }[];
  money: (k: number) => string;
}) {
  return (
    <section className="card overflow-x-auto p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <table className="w-full text-sm">
        <thead className="text-muted text-left">
          <tr>
            <th className="pb-2 font-medium" />
            <th className="pb-2 text-right font-medium">Takings</th>
            <th className="pb-2 text-right font-medium">Profit</th>
            <th className="pb-2 text-right font-medium">Margin</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((r) => {
            const m = marginPercent(r.costedRevenue, r.cost);
            return (
              <tr key={r.key}>
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-right tabular-nums">{money(r.revenue)}</td>
                <td className="py-2 text-right font-medium tabular-nums">{money(r.profit)}</td>
                <td className="py-2 text-right tabular-nums">
                  {m === null ? "–" : `${m}%`}
                  {r.costedRevenue < r.revenue && (
                    <span className="text-amber-700" title="Some items here have no cost price">
                      *
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.some((r) => r.costedRevenue < r.revenue) && (
        <p className="text-muted mt-3 text-xs">
          * Includes items with no cost price: their takings are left out of profit and margin.
        </p>
      )}
    </section>
  );
}
