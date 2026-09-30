import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/roles";
import { StaffForm, type LocationOption } from "./staff-form";

export default async function StaffPage() {
  const me = await requireStaff(["owner"]);
  const supabase = await createClient();

  const [{ data: staff, error: staffError }, { data: locations, error: locationsError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, role, location_id, is_active, locations(name)")
      .order("is_active", { ascending: false })
      .order("full_name"),
    supabase.from("locations").select("id, name, kind").eq("is_active", true).order("kind").order("name"),
  ]);
  if (staffError) throw staffError;
  if (locationsError) throw locationsError;

  const locationOptions: LocationOption[] = locations;

  return (
    <div className="space-y-6">
      <div className="card divide-border divide-y">
        {staff.map((person) => (
          <details key={person.id} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {person.full_name}
                  {person.id === me.id && <span className="text-muted ml-2 text-xs">(you)</span>}
                </p>
                <p className="text-muted truncate text-sm">{person.email}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs">
                <span className="bg-background rounded px-2 py-1">{ROLE_LABELS[person.role]}</span>
                <span className="bg-background rounded px-2 py-1">{person.locations?.name ?? "All locations"}</span>
                {!person.is_active && <span className="bg-danger/10 text-danger rounded px-2 py-1">Inactive</span>}
              </div>
            </summary>
            <div className="border-border bg-background/50 border-t p-4">
              <StaffForm person={person} locations={locationOptions} />
            </div>
          </details>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold">Add a staff member</h2>
        <p className="text-muted mt-1 text-sm">
          They sign in with this email and password. Share the password with them privately; you can reset it here
          later.
        </p>
        <div className="mt-4">
          <StaffForm locations={locationOptions} />
        </div>
      </div>
    </div>
  );
}
