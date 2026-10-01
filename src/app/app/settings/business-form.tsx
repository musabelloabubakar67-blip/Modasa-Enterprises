"use client";

import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/form";
import type { BusinessSettings } from "@/lib/business";
import { updateBusiness } from "./actions";

export function BusinessForm({ business }: { business: BusinessSettings }) {
  return (
    <ActionForm action={updateBusiness} className="card space-y-4 p-6">
      {(state) => {
        const errors = state.fieldErrors ?? {};
        return (
          <>
            <FormMessage state={state} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name" name="name" error={errors.name} hint="Shown on screens and receipts.">
                <input id="name" name="name" className="input" defaultValue={business.name} required />
              </Field>
              <Field label="Registered name" name="legal_name" error={errors.legal_name} hint="Optional, for invoices.">
                <input id="legal_name" name="legal_name" className="input" defaultValue={business.legal_name ?? ""} />
              </Field>
              <Field label="Phone" name="phone" error={errors.phone}>
                <input id="phone" name="phone" className="input" defaultValue={business.phone ?? ""} />
              </Field>
              <Field label="Email" name="email" error={errors.email}>
                <input id="email" name="email" type="email" className="input" defaultValue={business.email ?? ""} />
              </Field>
              <Field label="Currency" name="currency" error={errors.currency} hint="3-letter code, e.g. NGN.">
                <input
                  id="currency"
                  name="currency"
                  className="input uppercase"
                  defaultValue={business.currency}
                  maxLength={3}
                  required
                />
              </Field>
            </div>
            <Field label="Head office address" name="address" error={errors.address}>
              <textarea id="address" name="address" rows={2} className="input" defaultValue={business.address ?? ""} />
            </Field>
            <Field
              label="Receipt footer"
              name="receipt_footer"
              error={errors.receipt_footer}
              hint="Printed at the bottom of every receipt, e.g. your returns policy."
            >
              <textarea
                id="receipt_footer"
                name="receipt_footer"
                rows={3}
                className="input"
                defaultValue={business.receipt_footer ?? ""}
              />
            </Field>
            <fieldset className="border-border space-y-3 rounded-md border p-4">
              <legend className="px-1 text-sm font-medium">VAT</legend>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="vat_enabled" className="mt-1" defaultChecked={business.vat_enabled} />
                <span>
                  Show VAT on receipts
                  <span className="text-muted block text-xs">
                    Only if the business is VAT-registered. Prices stay the same — they already include VAT; receipts
                    show how much of the total is VAT.
                  </span>
                </span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="VAT rate (%)" name="vat_rate" error={errors.vat_rate}>
                  <input
                    id="vat_rate"
                    name="vat_rate"
                    className="input"
                    inputMode="decimal"
                    defaultValue={String(business.vat_rate)}
                  />
                </Field>
                <Field label="VAT / TIN number" name="vat_number" error={errors.vat_number} hint="Printed on receipts.">
                  <input id="vat_number" name="vat_number" className="input" defaultValue={business.vat_number ?? ""} />
                </Field>
              </div>
            </fieldset>
            <SubmitButton>Save changes</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
