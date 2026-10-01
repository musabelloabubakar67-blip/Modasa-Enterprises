import Link from "next/link";
import { getBusinessSettings } from "@/lib/business";
import { formatDate, todayInBusinessZone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { addDays, dateList, oneWeekAgo, products, salesDaily, shortDate } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";
import { LineChart } from "@/components/charts/line-chart";
import { seriesColor } from "@/components/charts/colors";
import { BarList } from "@/components/charts/bar-list";
import { getActiveLocations } from "./stock/data";

/** The owner's and managers' home page: today at a glance, what needs attention, recent trend. */
export async function OwnerDashboard({ name }: { name: string }) {
  const supabase = await createClient();
  const today = todayInBusinessZone();
  const lastWeek = addDays(today, -7);
  const from = addDays(today, -30);
  const monthStart = `${today.slice(0, 8)}01`;

  const [locations, daily, week, business, attention, tills, sameTimeLastWeek] = await Promise.all([
    getActiveLocations(),
    salesDaily(supabase, from < monthStart ? from : monthStart, today, null),
    products(supabase, { from: addDays(today, -6), to: today, shop: null, preset: "7d" }),
    getBusinessSettings(),
    getAttention(supabase),
    supabase
      .from("shifts")
      .select("location_id, status, opened_at, closed_at, counted_cash_kobo, expected_cash_kobo")
      .or(`status.eq.open,closed_at.gte.${today}T00:00:00+01:00`)
      .order("opened_at", { ascending: false }),
    // Last week's sales up to this time of day, so the morning comparison isn't against a full day.
    supabase
      .from("sales")
      .select("location_id, total_kobo")
      .gte("created_at", `${lastWeek}T00:00:00+01:00`)
      .lte("created_at", oneWeekAgo()),
  ]);
  const shops = locations.filter((l) => l.kind === "shop");
  const money = (k: number) => formatMoney(k, business.currency);

  const net = (r: { gross_kobo: number; refunds_kobo: number }) => r.gross_kobo - r.refunds_kobo;
  const on = (day: string, shop?: string) => daily.filter((r) => r.day === day && (!shop || r.location_id === shop));
  const sum = (rows: typeof daily) => ({
    total: rows.reduce((s, r) => s + net(r), 0),
    count: rows.reduce((s, r) => s + Number(r.sales_count), 0),
  });
  const todayAll = sum(on(today));
  const lastWeekRows = sameTimeLastWeek.data ?? [];
  const lastWeekSoFar = (shop?: string) => {
    const rows = lastWeekRows.filter((r) => !shop || r.location_id === shop);
    return { total: rows.reduce((s, r) => s + r.total_kobo, 0), count: rows.length };
  };
  const lastWeekAll = lastWeekSoFar();
  const monthAll = sum(daily.filter((r) => r.day >= monthStart));
  const weekday = new Date(`${lastWeek}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "long", timeZone: "UTC" });

  // Complete days only: today's partial figure would make every line dive at the end.
  const days = dateList(from, addDays(today, -1));
  const chartSeries = shops.map((shop, i) => ({
    key: shop.id,
    label: shop.name,
    color: seriesColor(i),
    values: days.map((d) => on(d, shop.id).reduce((s, r) => s + net(r), 0)),
  }));

  const tillFor = (shopId: string) => tills.data?.find((t) => t.location_id === shopId);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Good {greeting()}, {name.split(" ")[0]}
        </h1>
        <p className="text-muted text-sm">{formatDate(today)} · all shops</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Today">
        <Tile label="Sales today" value={money(todayAll.total)}>
          <Change now={todayAll.total} before={lastWeekAll.total} label={`vs last ${weekday} by this time`} />
        </Tile>
        <Tile label="Number of sales today" value={String(todayAll.count)}>
          <span className="text-muted">
            {lastWeekAll.count} last {weekday}
          </span>
        </Tile>
        <Tile
          label="Average sale today"
          value={todayAll.count ? money(Math.round(todayAll.total / todayAll.count / 100) * 100) : "–"}
        />
        <Tile label="This month so far" value={money(monthAll.total)}>
          <span className="text-muted">{monthAll.count} sales</span>
        </Tile>
      </section>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="card overflow-x-auto p-4">
          <h2 className="mb-3 font-semibold">Shops today</h2>
          <table className="w-full text-sm">
            <thead className="text-muted text-left">
              <tr>
                <th className="pb-2 font-medium">Shop</th>
                <th className="pb-2 text-right font-medium">Sales</th>
                <th className="pb-2 text-right font-medium">Takings</th>
                <th className="pb-2 text-right font-medium">vs last {weekday.slice(0, 3)}</th>
                <th className="pb-2 pl-4 font-medium">Till</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {shops.map((shop) => {
                const t = sum(on(today, shop.id));
                const lw = lastWeekSoFar(shop.id);
                const till = tillFor(shop.id);
                const diff =
                  till?.status === "closed" ? (till.counted_cash_kobo ?? 0) - (till.expected_cash_kobo ?? 0) : 0;
                return (
                  <tr key={shop.id}>
                    <td className="py-2">
                      <Link href={`/app/sales?shop=${shop.id}`} className="hover:underline">
                        {shop.name}
                      </Link>
                    </td>
                    <td className="py-2 text-right tabular-nums">{t.count}</td>
                    <td className="py-2 text-right font-medium tabular-nums">{money(t.total)}</td>
                    <td className="py-2 text-right">
                      <Change now={t.total} before={lw.total} />
                    </td>
                    <td className="py-2 pl-4 whitespace-nowrap">
                      {!till ? (
                        <span className="text-muted">Not opened</span>
                      ) : till.status === "open" ? (
                        <span className="text-success">● Open</span>
                      ) : diff === 0 ? (
                        <span className="text-muted">Closed · balanced</span>
                      ) : (
                        <Link href="/app/sales/shifts" className="text-danger font-medium hover:underline">
                          ⚠ Closed {diff < 0 ? `${money(-diff)} short` : `${money(diff)} over`}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Needs attention</h2>
          {attention.every((a) => a.count === 0) ? (
            <p className="text-success text-sm">✓ Nothing waiting.</p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {attention
                .filter((a) => a.count > 0)
                .map((a) => (
                  <li key={a.label}>
                    <Link
                      href={a.href}
                      className="hover:bg-background -mx-2 flex items-center justify-between rounded px-2 py-2"
                    >
                      <span>{a.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.urgent ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"}`}
                      >
                        {a.count}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-4">
        <LineChart
          title="Daily takings, last 30 full days"
          labels={days.map(shortDate)}
          series={chartSeries}
          currency={business.currency}
        />
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">Best sellers, last 7 days</h2>
          <Link href="/app/reports/products?preset=7d" className="text-accent text-sm hover:underline">
            All products →
          </Link>
        </div>
        <BarList
          currency={business.currency}
          rows={week.slice(0, 6).map((p) => ({
            key: p.sku_id,
            label: p.product_name,
            detail: [p.variant_label, `${Number(p.quantity)} ${p.unit} sold`].filter(Boolean).join(" · "),
            value: Number(p.revenue_kobo),
          }))}
        />
      </section>
    </div>
  );
}

async function getAttention(supabase: Awaited<ReturnType<typeof createClient>>) {
  const today = todayInBusinessZone();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [approvals, toSend, inTransit, shortages, deliveriesDue, collections, lowStock] = await Promise.all([
    count(supabase.from("adjustments").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(supabase.from("transfers").select("id", { count: "exact", head: true }).eq("status", "requested")),
    count(supabase.from("transfers").select("id", { count: "exact", head: true }).eq("status", "dispatched")),
    count(
      supabase
        .from("transfers")
        .select("id", { count: "exact", head: true })
        .eq("has_shortage", true)
        .is("shortage_resolved_at", null),
    ),
    count(
      supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("fulfilment", "delivery")
        .neq("fulfilment_status", "completed")
        .lte("delivery_date", today),
    ),
    count(
      supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("fulfilment", "collect_later")
        .neq("fulfilment_status", "completed"),
    ),
    count(supabase.from("stock_overview").select("sku_id", { count: "exact", head: true }).eq("is_low", true)),
  ]);
  return [
    {
      label: "Stock adjustments to approve",
      count: approvals,
      href: "/app/stock/adjustments?status=pending",
      urgent: false,
    },
    { label: "Transfer shortages to resolve", count: shortages, href: "/app/transfers?view=shortage", urgent: true },
    { label: "Deliveries due today or overdue", count: deliveriesDue, href: "/app/sales/pending", urgent: true },
    { label: "Transfers waiting to be sent", count: toSend, href: "/app/transfers?view=requested", urgent: false },
    { label: "Transfers in transit", count: inTransit, href: "/app/transfers?view=transit", urgent: false },
    { label: "Sold items awaiting collection", count: collections, href: "/app/sales/pending", urgent: false },
    { label: "Items at or below reorder level", count: lowStock, href: "/app/stock?show=low", urgent: false },
  ];
}

function greeting() {
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Lagos" }));
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-muted text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {children && <p className="mt-1 text-xs">{children}</p>}
    </div>
  );
}

/** "+12%" / "−8%" against an earlier figure, with words not just colour. */
function Change({ now, before, label }: { now: number; before: number; label?: string }) {
  if (before === 0) return <span className="text-muted">{label ? `no sales ${label}` : "–"}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span className={up ? "text-success" : "text-danger"}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%{label && <span className="text-muted"> {label}</span>}
    </span>
  );
}
