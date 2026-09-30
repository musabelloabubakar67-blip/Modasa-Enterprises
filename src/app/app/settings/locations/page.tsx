import { createClient } from "@/lib/supabase/server";
import { LocationForm, type LocationRow } from "./location-form";

export default async function LocationsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, code, kind, address, phone, is_active")
    .order("kind")
    .order("name");
  if (error) throw error;
  const locations: LocationRow[] = data;

  return (
    <div className="space-y-6">
      <p className="text-muted text-sm">
        Shops sell to customers; warehouses hold and dispatch stock. Every stock count, transfer and sale belongs to a
        location. Deactivate a location instead of deleting it so its history is kept.
      </p>

      <div className="card divide-border divide-y">
        {locations.length === 0 && <p className="text-muted p-4 text-sm">No locations yet.</p>}
        {locations.map((location) => (
          <details key={location.id} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {location.name} <span className="text-muted font-mono text-xs">{location.code}</span>
                </p>
                <p className="text-muted truncate text-sm">{location.address || "No address"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                <span className="bg-background rounded px-2 py-1 capitalize">{location.kind}</span>
                {!location.is_active && <span className="bg-danger/10 text-danger rounded px-2 py-1">Inactive</span>}
                <span className="text-muted group-open:hidden">Edit</span>
              </div>
            </summary>
            <div className="border-border bg-background/50 border-t p-4">
              <LocationForm location={location} />
            </div>
          </details>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold">Add a location</h2>
        <div className="mt-4">
          <LocationForm />
        </div>
      </div>
    </div>
  );
}
