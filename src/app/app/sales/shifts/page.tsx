import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getStaffNames } from "@/lib/staff-names";
import { createClient } from "@/lib/supabase/server";

export default async function ShiftsPage({ searchParams }: PageProps<"/app/sales/shifts">) {
  await requireStaff(["owner", "manager", "cashier"]);
  const { closed } = await searchParams;
  const supabase = await createClient();
  const { data: shifts, error } = await supabase
    .from("shifts")
    .select(
      `id, status, opened_at, opened_by, closed_at, closed_by, opening_float_kobo, close_note,
       counted_cash_kobo, counted_card_kobo, counted_transfer_kobo,
       expected_cash_kobo, expected_card_kobo, expected_transfer_kobo, locations(name), sales(count),
       drawer_openings(reason, created_at, opened_by)`,
    )
    .order("opened_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  const [names, { currency }] = await Promise.all([
    getStaffNames(shifts.flatMap((s) => [s.opened_by, s.closed_by, ...s.drawer_openings.map((d) => d.opened_by)])),
    getBusinessSettings(),
  ]);
  const money = (k: number) => formatMoney(k, currency);
  const who = (id: string | null) => (id && names.get(id)) || "—";

  return (
    <div className="space-y-4">
      {closed && (
        <p role="status" className="bg-success/10 text-success rounded-md px-3 py-2 text-sm">
          Till closed.
        </p>
      )}
      <p className="text-muted text-sm">
        Each session runs from opening the till to closing it. Differences between what the system expected and what was
        counted are highlighted.
      </p>
      <ul className="space-y-3">
        {shifts.length === 0 && <li className="card text-muted p-6 text-center text-sm">No till sessions yet.</li>}
        {shifts.map((s) => {
          const checks = [
            ["Cash", s.expected_cash_kobo, s.counted_cash_kobo],
            ["POS card", s.expected_card_kobo, s.counted_card_kobo],
            ["Transfer", s.expected_transfer_kobo, s.counted_transfer_kobo],
          ] as const;
          const off = checks.some(([, e, c]) => c !== null && e !== null && c !== e);
          return (
            <li key={s.id} className={`card space-y-2 p-4 ${off ? "border-danger/50" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {s.locations.name} · {formatDateTime(s.opened_at)}
                  {s.closed_at && <> – {formatDateTime(s.closed_at)}</>}
                </p>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${s.status === "open" ? "bg-accent/10 text-accent" : off ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}
                >
                  {s.status === "open" ? "Open" : off ? "Difference" : "Balanced"}
                </span>
              </div>
              <p className="text-muted text-sm">
                Opened by {who(s.opened_by)} · float {money(s.opening_float_kobo)} · {s.sales[0]?.count ?? 0} sales
                {s.closed_by && <> · closed by {who(s.closed_by)}</>}
              </p>
              {s.status === "closed" && (
                <table className="w-full text-sm">
                  <thead className="text-muted text-left">
                    <tr>
                      <th className="py-1 font-medium" />
                      <th className="py-1 text-right font-medium">Expected</th>
                      <th className="py-1 text-right font-medium">Counted</th>
                      <th className="py-1 text-right font-medium">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.map(([label, expected, counted]) => {
                      const d = counted === null || expected === null ? null : counted - expected;
                      return (
                        <tr key={label}>
                          <td className="py-1">{label}</td>
                          <td className="py-1 text-right tabular-nums">{expected === null ? "–" : money(expected)}</td>
                          <td className="py-1 text-right tabular-nums">
                            {counted === null ? "not entered" : money(counted)}
                          </td>
                          <td
                            className={`py-1 text-right font-medium tabular-nums ${d ? "text-danger" : d === 0 ? "text-success" : "text-muted"}`}
                          >
                            {d === null ? "–" : d === 0 ? "✓" : `${d > 0 ? "+" : "−"}${money(Math.abs(d))}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {s.close_note && <p className="text-sm">Note: “{s.close_note}”</p>}
              {s.drawer_openings.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-amber-700">
                    Drawer opened without a sale {s.drawer_openings.length} time
                    {s.drawer_openings.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="text-muted mt-1 space-y-0.5">
                    {s.drawer_openings.map((d, i) => (
                      <li key={i}>
                        {formatDateTime(d.created_at)} · {who(d.opened_by)} · “{d.reason}”
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
