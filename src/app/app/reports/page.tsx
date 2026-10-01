import { getBusinessSettings } from "@/lib/business";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { dateList, parseReportFilters, payments, salesDaily, shortDate } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";
import { LineChart } from "@/components/charts/line-chart";
import { seriesColor } from "@/components/charts/colors";
import { getActiveLocations } from "../stock/data";
import { filterQuery, ReportFilterBar, Stat } from "./filters";

const METHOD = { cash: "Cash", card: "POS card", transfer: "Bank transfer" } as const;

export default async function SalesReportPage({ searchParams }: PageProps<"/app/reports">) {
  const f = parseReportFilters(await searchParams);
  const supabase = await createClient();
  const [locations, daily, pay, { currency }] = await Promise.all([
    getActiveLocations(),
    salesDaily(supabase, f.from, f.to, f.shop),
    payments(supabase, f),
    getBusinessSettings(),
  ]);
  const money = (k: number) => formatMoney(k, currency);
  const shops = locations.filter((l) => l.kind === "shop");
  const shown = f.shop ? shops.filter((s) => s.id === f.shop) : shops;

  const gross = daily.reduce((s, r) => s + r.gross_kobo, 0);
  const refunds = daily.reduce((s, r) => s + r.refunds_kobo, 0);
  const count = daily.reduce((s, r) => s + Number(r.sales_count), 0);
  const items = daily.reduce((s, r) => s + Number(r.items_sold), 0);
  const days = dateList(f.from, f.to);

  return (
    <>
      <ReportFilterBar
        filters={f}
        shops={shops}
        exportHref={`/app/reports/export?${filterQuery(f, { report: "sales" })}`}
      />

      <p className="text-muted text-sm">
        {formatDate(f.from)} – {formatDate(f.to)} · {f.shop ? shown[0]?.name : "all shops"}
      </p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Net sales"
          value={money(gross - refunds)}
          note={refunds ? `${money(gross)} sold, ${money(refunds)} refunded` : undefined}
        />
        <Stat label="Number of sales" value={String(count)} note={`${items} items`} />
        <Stat label="Average sale" value={count ? money(Math.round(gross / count / 100) * 100) : "–"} />
        <Stat label="Refunds" value={money(refunds)} />
      </section>

      {days.length > 1 && (
        <section className="card p-4">
          <LineChart
            title="Daily takings"
            labels={days.map(shortDate)}
            currency={currency}
            series={shown.map((shop) => ({
              key: shop.id,
              label: shop.name,
              color: seriesColor(shops.findIndex((s) => s.id === shop.id)),
              values: days.map((d) =>
                daily
                  .filter((r) => r.day === d && r.location_id === shop.id)
                  .reduce((s, r) => s + r.gross_kobo - r.refunds_kobo, 0),
              ),
            }))}
          />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-x-auto p-4">
          <h2 className="mb-3 font-semibold">By shop</h2>
          <table className="w-full text-sm">
            <thead className="text-muted text-left">
              <tr>
                <th className="pb-2 font-medium">Shop</th>
                <th className="pb-2 text-right font-medium">Sales</th>
                <th className="pb-2 text-right font-medium">Net</th>
                <th className="pb-2 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {shown.map((shop) => {
                const rows = daily.filter((r) => r.location_id === shop.id);
                const net = rows.reduce((s, r) => s + r.gross_kobo - r.refunds_kobo, 0);
                return (
                  <tr key={shop.id}>
                    <td className="py-2">{shop.name}</td>
                    <td className="py-2 text-right tabular-nums">
                      {rows.reduce((s, r) => s + Number(r.sales_count), 0)}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">{money(net)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {gross - refunds > 0 ? `${Math.round((net / (gross - refunds)) * 100)}%` : "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="card overflow-x-auto p-4">
          <h2 className="mb-3 font-semibold">By payment method</h2>
          <table className="w-full text-sm">
            <thead className="text-muted text-left">
              <tr>
                <th className="pb-2 font-medium">Method</th>
                <th className="pb-2 text-right font-medium">Received</th>
                <th className="pb-2 text-right font-medium">Refunded</th>
                <th className="pb-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {pay.map((p) => (
                <tr key={p.method}>
                  <td className="py-2">{METHOD[p.method]}</td>
                  <td className="py-2 text-right tabular-nums">{money(p.received_kobo)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {p.refunded_kobo ? `−${money(p.refunded_kobo)}` : "–"}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {money(p.received_kobo - p.refunded_kobo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted mt-3 text-xs">
            Use this to check against bank statements and POS terminal settlements.
          </p>
        </section>
      </div>
    </>
  );
}
