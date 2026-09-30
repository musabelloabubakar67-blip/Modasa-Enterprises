import { todayInBusinessZone } from "@/lib/dates";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { getActiveLocations, isManager } from "../../data";
import { ReceiptForm } from "../receipt-form";

export default async function NewDeliveryPage() {
  const staff = await requireStaff(["owner", "manager", "warehouse"]);
  const [locations, { currency }] = await Promise.all([getActiveLocations(), getBusinessSettings()]);
  const warehouses = locations.filter(
    (l) => l.kind === "warehouse" && (isManager(staff.role) || l.id === staff.locationId),
  );

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/app/stock/deliveries" className="text-muted text-sm hover:underline">
        ← Deliveries
      </Link>
      <h2 className="text-xl font-semibold">New delivery</h2>
      {warehouses.length === 0 ? (
        <p className="card p-6 text-sm">There is no active warehouse you can receive at.</p>
      ) : (
        <ReceiptForm
          initial={{
            location_id: warehouses[0].id,
            supplier_name: "",
            supplier_reference: "",
            received_on: todayInBusinessZone(),
            note: "",
            lines: [],
          }}
          warehouses={warehouses}
          canCost={isManager(staff.role)}
          currency={currency}
        />
      )}
    </div>
  );
}
