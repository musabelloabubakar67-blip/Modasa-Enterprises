"use client";

import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/form";
import type { LocationKind } from "@/lib/roles";
import { saveLocation } from "../actions";

export type LocationRow = {
  id: string;
  name: string;
  code: string;
  kind: LocationKind;
  address: string | null;
  phone: string | null;
  public_name: string | null;
  is_active: boolean;
};

export function LocationForm({ location }: { location?: LocationRow }) {
  const prefix = location?.id ?? "new";

  return (
    <ActionForm action={saveLocation} resetOnSuccess={!location} className="space-y-4">
      {(state) => {
        const errors = state.fieldErrors ?? {};
        return (
          <>
            <FormMessage state={state} />
            {location && <input type="hidden" name="id" value={location.id} />}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Name" name={`${prefix}-name`} error={errors.name}>
                <input id={`${prefix}-name`} name="name" className="input" defaultValue={location?.name} required />
              </Field>
              <Field label="Code" name={`${prefix}-code`} error={errors.code} hint="Short label, e.g. SH1.">
                <input
                  id={`${prefix}-code`}
                  name="code"
                  className="input font-mono uppercase"
                  defaultValue={location?.code}
                  maxLength={10}
                  required
                />
              </Field>
              <Field label="Type" name={`${prefix}-kind`} error={errors.kind}>
                <select id={`${prefix}-kind`} name="kind" className="input" defaultValue={location?.kind ?? "shop"}>
                  <option value="shop">Shop</option>
                  <option value="warehouse">Warehouse</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Field label="Address" name={`${prefix}-address`} error={errors.address}>
                  <input
                    id={`${prefix}-address`}
                    name="address"
                    className="input"
                    defaultValue={location?.address ?? ""}
                  />
                </Field>
              </div>
              <Field label="Phone" name={`${prefix}-phone`} error={errors.phone}>
                <input id={`${prefix}-phone`} name="phone" className="input" defaultValue={location?.phone ?? ""} />
              </Field>
            </div>
            <div className="sm:max-w-xs">
              <Field
                label="Name on the website"
                name={`${prefix}-public-name`}
                error={errors.public_name}
                hint="What customers call this shop, e.g. Lekki. Shops only."
              >
                <input
                  id={`${prefix}-public-name`}
                  name="public_name"
                  className="input"
                  defaultValue={location?.public_name ?? ""}
                />
              </Field>
            </div>
            {location && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_active" defaultChecked={location.is_active} />
                Active
              </label>
            )}
            <SubmitButton>{location ? "Save location" : "Add location"}</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
