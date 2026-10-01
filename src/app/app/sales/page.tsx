import Link from "next/link";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { formatDate, formatDateTime, todayInBusinessZone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { getActiveLocations, isManager } from "../stock/data";
import { PAYMENT_LABELS } from "@/lib/payments";

const METHOD = PAYMENT_LABELS;
const HANDOVER = { taken: null, collect_later: "Collect later", delivery: "Delivery" } as const;

export default async function SalesPage({ searchParams }: PageProps<"/app/sales">) {
  const staff = await requireStaff(["owner", "manager", "cashier"]);
  const params = await searchParams;
  const manager = isManager(staff.role);
  const shops = (await getActiveLocations()).filter((l) => l.kind === "shop");
  const shop = manager ? (z.uuid().safeParse(params.shop).data ?? "") : (staff.locationId ?? "");
  const date = z.iso.date().safeParse(params.date).data ?? todayInBusinessZone();
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const supabase = await createClient();
  let query = supabase
    .from("sales")
    .select(
      "id, number, created_at, total_kobo, fulfilment, fulfilment_status, locations(name), customers(name, phone), sale_lines(count), sale_payments(method, amount_kobo), returns(refund_kobo, refund_method)",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (shop) query = query.eq("location_id", shop);
  if (q) {
    // Searching by receipt number or customer phone looks across all dates.
    if (q.toUpperCase().startsWith("INV")) query = query.ilike("number", `%${q.replace(/[\\%_]/g, "")}%`);
    else {
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", q.replace(/\D/g, ""))
        .maybeSingle();
      // No such customer: match nothing rather than everything.
      query = query.eq("customer_id", customer?.id ?? "00000000-0000-0000-0000-000000000000");
    }
  } else {
    query = query.gte("created_at", `${date}T00:00:00+01:00`).lte("created_at", `${date}T23:59:59.999+01:00`);
  }
  const [{ data: sales, error }, { currency }] = await Promise.all([query, getBusinessSettings()]);
  if (error) throw error;

  const byMethod = { cash: 0, card: 0, transfer: 0, online: 0 };
  let refunds = 0;
  for (const s of sales) {
    s.sale_payments.forEach((p) => (byMethod[p.method] += p.amount_kobo));
    s.returns.forEach((r) => {
      byMethod[r.refund_method] -= r.refund_kobo;
      refunds += r.refund_kobo;
    });
  }
  const total = sales.reduce((sum, s) => sum + s.total_kobo, 0);

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2">
        {manager && (
          <label>
            <span className="label text-xs">Shop</span>
            <select name="shop" defaultValue={shop} className="input w-auto">
              <option value="">All shops</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="label text-xs">Date</span>
          <input type="date" name="date" defaultValue={date} className="input w-auto" />
        </label>
        <label className="min-w-48 flex-1">
          <span className="label text-xs">Find a sale</span>
          <input name="q" defaultValue={q} className="input" placeholder="Receipt no. (INV-…) or customer phone" />
        </label>
        <button type="submit" className="btn btn-secondary">
          Show
        </button>
      </form>

      {!q && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label={`Sales on ${formatDate(date)}`} value={`${sales.length}`} />
          <Stat label="Total sold" value={formatMoney(total, currency)} />
          {(Object.keys(METHOD) as (keyof typeof METHOD)[]).map((m) => (
            <Stat key={m} label={`${METHOD[m]} (net)`} value={formatMoney(byMethod[m], currency)} />
          ))}
        </div>
      )}
      {!q && refunds > 0 && (
        <p className="text-muted text-sm">Refunds on these sales: {formatMoney(refunds, currency)}</p>
      )}

      <ul className="card divide-border divide-y">
        {sales.length === 0 && <li className="text-muted p-6 text-center text-sm">No sales found.</li>}
        {sales.map((s) => {
          const handover = HANDOVER[s.fulfilment];
          return (
            <li key={s.id}>
              <Link href={`/app/sales/${s.id}`} className="hover:bg-background flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {s.number}
                    {!shop && <span className="text-muted font-normal"> · {s.locations.name}</span>}
                  </p>
                  <p className="text-muted truncate text-sm">
                    {formatDateTime(s.created_at)} · {s.sale_lines[0]?.count ?? 0} item
                    {s.sale_lines[0]?.count === 1 ? "" : "s"}
                    {s.customers && ` · ${s.customers.name}`} ·{" "}
                    {s.sale_payments.map((p) => METHOD[p.method]).join(" + ")}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <p className="font-semibold tabular-nums">{formatMoney(s.total_kobo, currency)}</p>
                  {handover && (
                    <p
                      className={`text-xs ${s.fulfilment_status === "completed" ? "text-muted" : "font-medium text-amber-700"}`}
                    >
                      {handover}
                      {s.fulfilment_status === "completed" ? " · done" : " · pending"}
                    </p>
                  )}
                  {s.returns.length > 0 && <p className="text-danger text-xs">Returned items</p>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="text-muted truncate text-xs">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
