"use client";

import { useState } from "react";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/form";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, STAFF_ROLES, roleNeedsLocation, type StaffRole } from "@/lib/roles";
import { saveStaff } from "../actions";

export type StaffRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  location_id: string | null;
  is_active: boolean;
};

export type LocationOption = { id: string; name: string; kind: "shop" | "warehouse" };

export function StaffForm({ person, locations }: { person?: StaffRow; locations: LocationOption[] }) {
  const [role, setRole] = useState<StaffRole>(person?.role ?? "cashier");
  const prefix = person?.id ?? "new";
  const needsLocation = roleNeedsLocation(role);
  // Cashiers work in shops and warehouse staff in warehouses; owners/managers can pick any.
  const locationChoices = locations.filter(
    (l) =>
      (role === "cashier" && l.kind === "shop") || (role === "warehouse" && l.kind === "warehouse") || !needsLocation,
  );

  return (
    <ActionForm action={saveStaff} resetOnSuccess={!person} className="space-y-4">
      {(state) => {
        const errors = state.fieldErrors ?? {};
        return (
          <>
            <FormMessage state={state} />
            {person && <input type="hidden" name="id" value={person.id} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" name={`${prefix}-full_name`} error={errors.full_name}>
                <input
                  id={`${prefix}-full_name`}
                  name="full_name"
                  className="input"
                  defaultValue={person?.full_name}
                  required
                />
              </Field>
              <Field
                label="Email"
                name={`${prefix}-email`}
                error={errors.email}
                hint={person ? "Email can't be changed." : undefined}
              >
                <input
                  id={`${prefix}-email`}
                  name="email"
                  type="email"
                  className="input"
                  defaultValue={person?.email}
                  disabled={!!person}
                  required={!person}
                />
              </Field>
              <Field label="Phone" name={`${prefix}-phone`} error={errors.phone}>
                <input id={`${prefix}-phone`} name="phone" className="input" defaultValue={person?.phone ?? ""} />
              </Field>
              <Field
                label={person ? "New password" : "Starting password"}
                name={`${prefix}-password`}
                error={errors.password}
                hint={person ? "Leave blank to keep the current password." : "At least 8 characters."}
              >
                <input
                  id={`${prefix}-password`}
                  name="password"
                  type="password"
                  className="input"
                  autoComplete="new-password"
                  minLength={8}
                  required={!person}
                />
              </Field>
              <Field label="Role" name={`${prefix}-role`} error={errors.role} hint={ROLE_DESCRIPTIONS[role]}>
                <select
                  id={`${prefix}-role`}
                  name="role"
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Location"
                name={`${prefix}-location_id`}
                error={errors.location_id}
                hint={needsLocation ? undefined : "Optional. Leave as 'All locations' for full access."}
              >
                <select
                  id={`${prefix}-location_id`}
                  name="location_id"
                  className="input"
                  defaultValue={person?.location_id ?? ""}
                  key={role}
                  required={needsLocation}
                >
                  <option value="">{needsLocation ? "Choose a location…" : "All locations"}</option>
                  {locationChoices.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {person && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_active" defaultChecked={person.is_active} />
                Active (can sign in)
              </label>
            )}
            <SubmitButton>{person ? "Save changes" : "Add staff member"}</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
