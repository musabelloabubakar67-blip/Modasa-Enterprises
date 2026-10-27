"use client";

import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/form";
import { resetTrainingData } from "./actions";

/** Shown only on a training copy (see supabase/migrations/20261020000015_training_reset.sql). */
export function TrainingReset() {
  return (
    <ActionForm action={resetTrainingData} resetOnSuccess className="card border-danger/40 space-y-4 p-6">
      {(state) => (
        <>
          <div>
            <h2 className="font-semibold">Training copy: start again</h2>
            <p className="text-muted mt-1 text-sm">
              Deletes every product, category, stock count, adjustment, delivery, transfer, sale, return, shift,
              customer and online order, so you can import again from scratch. Logins, business settings, units and
              delivery areas are kept. This can&apos;t be undone.
            </p>
          </div>
          <FormMessage state={state} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="locations" className="mt-1" defaultChecked />
            <span>
              Also delete shops and warehouses
              <span className="text-muted block text-xs">
                Untick to keep them, e.g. to import products and counts again for the same locations. Cashiers and
                warehouse staff must belong to a location, so with any of them set up the locations have to stay.
              </span>
            </span>
          </label>
          <Field label="Type RESET to confirm" name="confirm">
            <input id="confirm" name="confirm" className="input max-w-xs" autoComplete="off" />
          </Field>
          <SubmitButton pendingText="Clearing…" className="btn bg-danger text-white">
            Clear training data
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
