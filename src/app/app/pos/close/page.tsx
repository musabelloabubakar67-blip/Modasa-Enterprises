import Link from "next/link";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { isManager } from "../../stock/data";
import { CloseTillForm } from "./close-form";
import { PAYMENT_LABELS } from "@/lib/payments";

const METHOD = PAYMENT_LABELS;

export default async function CloseTillPage({ searchParams }: PageProps<"/app/pos/close">) {
  const staff = await requireStaff(["owner", "manager", "cashier"]);
  const params = await searchParams;
  const shopId = isManager(staff.role) ? z.uuid().safeParse(params.shop).data : staff.locationId;
  if (!shopId) return <p className="card p-6 text-sm">Choose a shop from the Point of sale page first.</p>;

  const supabase = await createClient();
  const { data: shift } = await supabase
    .from("shifts")
    .select("id, opened_at, opening_float_kobo, locations(name)")
    .eq("location_id", shopId)
    .eq("status", "open")
    .maybeSingle();
  if (!shift) {
    return (
      <div className="max-w-md space-y-3">
        <p className="card p-6 text-sm">The till at this shop isn&apos;t open.</p>
        <Link href="/app/sales/shifts" className="text-accent text-sm hover:underline">
          See past till sessions
        </Link>
      </div>
    );
  }

  const [{ data: expected }, { count }, { currency }] = await Promise.all([
    supabase.rpc("shift_expected", { p_shift_id: shift.id }),
    supabase.from("sales").select("id", { count: "exact", head: true }).eq("shift_id", shift.id),
    getBusinessSettings(),
  ]);
  // Website payments never pass through the till, so they aren't part of cash-up.
  const rows = (expected ?? [])
    .filter((e) => e.method !== "online")
    .map((e) => ({
      method: e.method,
      sales: e.sales_kobo,
      refunds: e.refunds_kobo,
      expected: e.expected_kobo,
    }));

  return (
    <div className="max-w-2xl space-y-4">
      <Link href={`/app/pos?shop=${shopId}`} className="text-muted text-sm hover:underline">
        ← Back to the till
      </Link>
      <h1 className="text-2xl font-semibold">Close till · {shift.locations.name}</h1>
      <p className="text-muted text-sm">
        Opened {formatDateTime(shift.opened_at)} with a float of {formatMoney(shift.opening_float_kobo, currency)} ·{" "}
        {count ?? 0} sale{count === 1 ? "" : "s"}
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted border-border border-b text-left">
            <tr>
              <th className="p-3 font-medium">Method</th>
              <th className="p-3 text-right font-medium">Sales</th>
              <th className="p-3 text-right font-medium">Refunds</th>
              <th className="p-3 text-right font-medium">Should have</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((r) => (
              <tr key={r.method}>
                <td className="p-3">
                  {METHOD[r.method]}
                  {r.method === "cash" && <span className="text-muted text-xs"> (incl. float)</span>}
                </td>
                <td className="p-3 text-right tabular-nums">{formatMoney(r.sales, currency)}</td>
                <td className="p-3 text-right tabular-nums">
                  {r.refunds ? `−${formatMoney(r.refunds, currency)}` : "–"}
                </td>
                <td className="p-3 text-right font-semibold tabular-nums">{formatMoney(r.expected, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CloseTillForm
        shiftId={shift.id}
        currency={currency}
        expected={
          Object.fromEntries(rows.map((r) => [r.method, r.expected])) as Record<"cash" | "card" | "transfer", number>
        }
      />
    </div>
  );
}
