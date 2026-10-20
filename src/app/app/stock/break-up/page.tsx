import { requireStaff } from "@/lib/auth";
import { getActiveLocations } from "../data";
import { BreakUpForm } from "./break-up-form";

export default async function BreakUpSetPage() {
  await requireStaff(["owner", "manager"]);
  const locations = await getActiveLocations();

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Break up a set</h2>
        <p className="text-muted mt-1 text-sm">
          For when a set is opened and its pieces are sold one by one. The sets come out of stock and the single pieces
          go in, at the same location. The single piece must already exist as its own item, with its own price.
        </p>
      </div>
      {locations.length === 0 ? (
        <p className="card p-6 text-sm">Add a location first (Settings → Locations).</p>
      ) : (
        <BreakUpForm locations={locations} />
      )}
    </div>
  );
}
