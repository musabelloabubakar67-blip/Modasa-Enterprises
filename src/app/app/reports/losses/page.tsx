import Link from "next/link";
import { getBusinessSettings } from "@/lib/business";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatQty } from "@/lib/quantity";
import { losses, parseReportFilters } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";
import { getActiveLocations } from "../../stock/data";
import { filterQuery, ReportFilterBar, Stat } from "../filters";

const KINDS = ["Write-off", "Count shortfall", "Lost in transit"] as const;

export default async function LossesReportPage({ searchParams }: PageProps<"/app/reports/losses">) {
  const f = parseReportFilters(await searchParams);
  const supabase = await createClient();
  const [locations, rows, { currency }] = await Promise.all([
    getActiveLocations(),
    losses(supabase, f),
    getBusinessSettings(),
  ]);
  const money = (k: number) => formatMoney(k, currency);
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const valueOf = (kind?: string) =>
    rows.filter((r) => !kind || r.kind === kind).reduce((s, r) => s + (r.value_kobo ?? 0), 0);
  const unvalued = rows.filter((r) => r.value_kobo === null).length;

  return (
    <>
      <ReportFilterBar
        filters={f}
        shops={locations}
        exportHref={`/app/reports/export?${filterQuery(f, { report: "losses" })}`}
      />
      <p className="text-muted text-sm">
        {formatDate(f.from)} – {formatDate(f.to)}. Valued at each item&apos;s current cost price.
        {unvalued > 0 && ` ${unvalued} line${unvalued === 1 ? " has" : "s have"} no cost price and aren't valued.`}
      </p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total lost" value={money(valueOf())} note={`${rows.length} entries`} />
        {KINDS.map((k) => (
          <Stat
            key={k}
            label={k}
            value={money(valueOf(k))}
            note={`${rows.filter((r) => r.kind === k).length} entries`}
          />
        ))}
      </section>

      <section className="card overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead className="text-muted text-left">
            <tr>
              <th className="pb-2 font-medium">When</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Where</th>
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Value</th>
              <th className="pb-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted py-6 text-center">
                  No losses recorded in this period.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-2 whitespace-nowrap">{r.happened_at ? formatDateTime(r.happened_at) : "—"}</td>
                <td className="py-2">{r.kind}</td>
                <td className="py-2">{locationName.get(r.location_id) ?? "—"}</td>
                <td className="py-2">
                  <Link href={`/app/stock/${r.sku_id}`} className="hover:underline">
                    {r.product_name}
                    {r.variant_label && ` · ${r.variant_label}`}
                  </Link>
                </td>
                <td className="py-2 text-right tabular-nums">{formatQty(Number(r.quantity))}</td>
                <td className="py-2 text-right font-medium tabular-nums">
                  {r.value_kobo === null ? "no cost" : money(r.value_kobo)}
                </td>
                <td className="text-muted py-2">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
