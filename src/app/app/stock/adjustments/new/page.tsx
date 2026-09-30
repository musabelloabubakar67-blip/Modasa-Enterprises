import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getActiveLocations, isManager } from "../../data";
import { AdjustmentForm } from "../adjustment-form";

export default async function NewAdjustmentPage({ searchParams }: PageProps<"/app/stock/adjustments/new">) {
  const staff = await requireStaff();
  const { kind } = await searchParams;
  const manager = isManager(staff.role);
  const locations = (await getActiveLocations()).filter((l) => manager || l.id === staff.locationId);
  const kinds = manager ? (["count", "damage", "opening"] as const) : (["count", "damage"] as const);
  const initialKind = kinds.find((k) => k === kind) ?? "count";

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/app/stock/adjustments" className="text-muted text-sm hover:underline">
        ← Adjustments
      </Link>
      <h2 className="text-xl font-semibold">New stock adjustment</h2>
      {locations.length === 0 ? (
        <p className="card p-6 text-sm">You aren&apos;t assigned to a location. Ask the owner to set one.</p>
      ) : (
        <AdjustmentForm locations={locations} kinds={[...kinds]} initialKind={initialKind} needsApproval={!manager} />
      )}
    </div>
  );
}
