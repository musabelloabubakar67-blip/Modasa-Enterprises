import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { isManager } from "../../stock/data";
import { FulfilmentButtons } from "../fulfilment-buttons";

export default async function PendingPage() {
  const staff = await requireStaff(["owner", "manager", "cashier"]);
  const supabase = await createClient();
  let query = supabase
    .from("sales")
    .select(
      "id, number, created_at, fulfilment, fulfilment_status, delivery_address, delivery_area, delivery_date, locations(name), customers(name, phone), sale_lines(quantity, skus(code, variant_label, products(name)))",
    )
    .neq("fulfilment_status", "completed")
    .order("delivery_date", { ascending: true, nullsFirst: false })
    .order("created_at");
  if (!isManager(staff.role) && staff.locationId) query = query.eq("location_id", staff.locationId);
  const { data: sales, error } = await query;
  if (error) throw error;

  return (
    <div className="space-y-4">
      <p className="text-muted text-sm">
        Paid for, but not yet with the customer. These items have already left stock — keep them aside.
      </p>
      <ul className="space-y-3">
        {sales.length === 0 && <li className="card text-muted p-6 text-center text-sm">Nothing waiting.</li>}
        {sales.map((s) => (
          <li key={s.id} className="card space-y-2 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {s.fulfilment === "delivery" ? "Delivery" : "Collection"} · {s.customers?.name}{" "}
                  <span className="text-muted font-normal">{s.customers?.phone}</span>
                </p>
                <p className="text-muted text-sm">
                  <Link href={`/app/sales/${s.id}`} className="hover:underline">
                    {s.number}
                  </Link>{" "}
                  · {s.locations.name} · sold {formatDateTime(s.created_at)}
                </p>
                {s.fulfilment === "delivery" && (
                  <p className="text-sm">
                    {s.delivery_address}
                    {s.delivery_area && ` (${s.delivery_area})`}
                    {s.delivery_date && <strong> · {formatDate(s.delivery_date)}</strong>}
                  </p>
                )}
              </div>
              {s.fulfilment_status === "out_for_delivery" && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Out for delivery</span>
              )}
            </div>
            <p className="text-sm">
              {s.sale_lines
                .map(
                  (l) =>
                    `${Number(l.quantity)} × ${l.skus.products.name}${l.skus.variant_label ? ` (${l.skus.variant_label})` : ""}`,
                )
                .join(", ")}
            </p>
            <FulfilmentButtons saleId={s.id} fulfilment={s.fulfilment} status={s.fulfilment_status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
