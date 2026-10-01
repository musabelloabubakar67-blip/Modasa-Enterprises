import { getBusinessSettings } from "@/lib/business";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { parseReportFilters, staff } from "@/lib/reports";
import { getStaffNames } from "@/lib/staff-names";
import { createClient } from "@/lib/supabase/server";
import { getActiveLocations } from "../../stock/data";
import { filterQuery, ReportFilterBar } from "../filters";

export default async function StaffReportPage({ searchParams }: PageProps<"/app/reports/staff">) {
  const f = parseReportFilters(await searchParams);
  const supabase = await createClient();
  const [locations, rows, { currency }] = await Promise.all([
    getActiveLocations(),
    staff(supabase, f),
    getBusinessSettings(),
  ]);
  const names = await getStaffNames(rows.map((r) => r.staff_id));
  const money = (k: number) => formatMoney(k, currency);
  const sorted = [...rows].sort((a, b) => b.sales_kobo - a.sales_kobo);

  return (
    <>
      <ReportFilterBar
        filters={f}
        shops={locations.filter((l) => l.kind === "shop")}
        exportHref={`/app/reports/export?${filterQuery(f, { report: "staff" })}`}
      />
      <p className="text-muted text-sm">
        {formatDate(f.from)} – {formatDate(f.to)}. Cash differences are from till sessions each person closed: negative
        means the drawer was short.
      </p>

      <section className="card overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead className="text-muted text-left">
            <tr>
              <th className="pb-2 font-medium">Staff member</th>
              <th className="pb-2 text-right font-medium">Sales</th>
              <th className="pb-2 text-right font-medium">Takings</th>
              <th className="pb-2 text-right font-medium">Returns</th>
              <th className="pb-2 text-right font-medium">Refunded</th>
              <th className="pb-2 text-right font-medium" title="Drawer opened without a sale">
                No-sale opens
              </th>
              <th className="pb-2 text-right font-medium">Tills closed</th>
              <th className="pb-2 text-right font-medium">Cash difference</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="text-muted py-6 text-center">
                  No staff activity in this period.
                </td>
              </tr>
            )}
            {sorted.map((r) => (
              <tr key={r.staff_id}>
                <td className="py-2">{names.get(r.staff_id) ?? "Former staff"}</td>
                <td className="py-2 text-right tabular-nums">{r.sales_count}</td>
                <td className="py-2 text-right font-medium tabular-nums">{money(r.sales_kobo)}</td>
                <td className="py-2 text-right tabular-nums">{r.returns_count || "–"}</td>
                <td className="py-2 text-right tabular-nums">{r.returns_kobo ? money(r.returns_kobo) : "–"}</td>
                <td
                  className={`py-2 text-right tabular-nums ${r.drawer_openings > 5 ? "font-medium text-amber-700" : ""}`}
                >
                  {r.drawer_openings || "–"}
                </td>
                <td className="py-2 text-right tabular-nums">{r.sessions_closed || "–"}</td>
                <td
                  className={`py-2 text-right font-medium tabular-nums ${r.cash_difference_kobo < 0 ? "text-danger" : r.cash_difference_kobo > 0 ? "text-amber-700" : ""}`}
                >
                  {r.sessions_closed === 0
                    ? "–"
                    : r.cash_difference_kobo === 0
                      ? "✓ none"
                      : `${r.cash_difference_kobo < 0 ? "−" : "+"}${money(Math.abs(r.cash_difference_kobo))}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-muted text-xs">
        Frequent no-sale drawer openings or repeated cash shortfalls are worth a conversation. See each session&apos;s
        details under Sales → Till sessions.
      </p>
    </>
  );
}
