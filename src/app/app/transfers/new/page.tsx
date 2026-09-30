import Link from "next/link";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getActiveLocations, isManager } from "../../stock/data";
import { TransferForm } from "../transfer-form";

export default async function NewTransferPage({ searchParams }: PageProps<"/app/transfers/new">) {
  const staff = await requireStaff();
  const params = await searchParams;
  const locations = await getActiveLocations();
  const ids = locations.map((l) => l.id);
  const valid = (v: unknown) => (z.uuid().safeParse(v).success && ids.includes(v as string) ? (v as string) : "");
  const firstWarehouse = locations.find((l) => l.kind === "warehouse")?.id ?? "";
  const mine = staff.locationId && ids.includes(staff.locationId) ? staff.locationId : "";

  // Sensible defaults: shops request from a warehouse; warehouse staff send to a shop.
  let from = valid(params.from);
  let to = valid(params.to);
  if (to && !from) from = locations.find((l) => l.kind === "warehouse" && l.id !== to)?.id ?? "";
  if (!from && !to) {
    const here = locations.find((l) => l.id === mine);
    if (here?.kind === "warehouse") {
      from = here.id;
      to = locations.find((l) => l.kind === "shop")?.id ?? "";
    } else {
      to = mine;
      from = firstWarehouse;
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/app/transfers" className="text-muted text-sm hover:underline">
        ← Transfers
      </Link>
      <h1 className="text-2xl font-semibold">New transfer</h1>
      {!isManager(staff.role) && (
        <p className="text-muted text-sm">
          You can request stock for your location, or send stock from it. The other location confirms when it arrives.
        </p>
      )}
      <TransferForm locations={locations} initialFrom={from === to ? "" : from} initialTo={to} />
    </div>
  );
}
